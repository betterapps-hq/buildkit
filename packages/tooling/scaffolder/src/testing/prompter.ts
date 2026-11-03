import { z } from "zod"
import { cancelled, type Cancelled, type Prompter, type SelectOption } from "../cli/prompter.js"

export type ScriptedAnswer =
  | string
  | string[]
  | boolean
  | Cancelled
  | ((question: AskedQuestion) => string | string[] | boolean | Cancelled)

export interface AskedQuestion {
  kind: "select" | "multiselect" | "confirm" | "text" | "password"
  message: string
  options?: string[]
  /** The options shown but not selectable. */
  disabled?: string[]
  /** Hints by option, such as the reason one is disabled. */
  hints?: Record<string, string>
  /** A multi-select that needs at least one. */
  required?: boolean
  initial?: unknown
}

function described(options: readonly SelectOption[]): Pick<AskedQuestion, "options" | "disabled" | "hints"> {
  const disabled = options.flatMap((option) => (option.disabled ? [option.value] : []))
  const hints = Object.fromEntries(options.flatMap((option) => (option.hint ? [[option.value, option.hint]] : [])))

  const question: Pick<AskedQuestion, "options" | "disabled" | "hints"> = {
    options: options.map((option) => option.value)
  }

  if (disabled.length > 0) {
    question.disabled = disabled
  }

  if (Object.keys(hints).length > 0) {
    question.hints = hints
  }

  return question
}

interface ScriptedPrompter {
  prompter: Prompter
  asked: AskedQuestion[]
  notes: string[]
}

/** A prompter that answers from a script and records every question, for wizard tests. */
export function scriptedPrompter(script: ScriptedAnswer[]): ScriptedPrompter {
  const asked: AskedQuestion[] = []
  const notes: string[] = []

  const next = (question: AskedQuestion) => {
    asked.push(question)
    const answer = script.shift()

    if (answer === undefined) {
      throw new Error(`Unexpected question: ${question.message}`)
    }

    return answer instanceof Function ? answer(question) : answer
  }

  const ofType = <T>(question: AskedQuestion, check: (value: unknown) => value is T): T | Cancelled => {
    const value = next(question)

    if (value === cancelled || check(value)) {
      return value
    }

    throw new Error(`Scripted answer ${JSON.stringify(value)} doesn't fit "${question.message}"`)
  }

  const isString = (value: unknown): value is string => z.string().safeParse(value).success
  const isBoolean = (value: unknown): value is boolean => z.boolean().safeParse(value).success
  const isList = (value: unknown): value is string[] => Array.isArray(value)

  return {
    asked,
    notes,
    prompter: {
      select: async (question) =>
        ofType(
          {
            kind: "select",
            message: question.message,
            ...described(question.options),
            initial: question.initialValue
          },
          isString
        ),
      multiselect: async (question) => {
        const shown: AskedQuestion = {
          kind: "multiselect",
          message: question.message,
          ...described(question.options),
          initial: question.initialValues
        }

        if (question.required) {
          shown.required = true
        }

        return ofType(shown, isList)
      },
      confirm: async (question) =>
        ofType({ kind: "confirm", message: question.message, initial: question.initialValue }, isBoolean),
      text: async (question) => {
        const value = ofType({ kind: "text", message: question.message, initial: question.initialValue }, isString)

        if (value !== cancelled && question.validate?.(value)) {
          throw new Error(`Scripted answer "${value}" fails validation: ${question.validate(value)}`)
        }

        return value
      },
      password: async (question) => ofType({ kind: "password", message: question.message }, isString),
      note: (message) => {
        notes.push(message)
      }
    }
  }
}
