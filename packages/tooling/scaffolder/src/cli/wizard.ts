import { z } from "zod"
import { findAddon, findTarget, type ExpandedQuestion, type ExpandedTemplate } from "../manifest/catalog.js"
import type { Answers, CatalogManifest } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { isRecord } from "../plan/json.js"
import type { EnvVar } from "../plan/types.js"
import {
  availableChoices,
  optionQuestions,
  requireTemplate,
  walkQuestions,
  type OptionQuestion
} from "../resolve/questions.js"
import { projectNameProblem, requireAddonId } from "../resolve/resolve.js"
import { cancelled, type Cancelled, type Prompter, type SelectOption } from "./prompter.js"

type SelectQuestion = Parameters<Prompter["select"]>[0]

type TextQuestion = Parameters<Prompter["text"]>[0]

/** An answer to an add-on option, as its schema's type gives it. */
type OptionAnswer = string | number | boolean | string[]

const text = z.string()

function isText(value: unknown): value is string {
  return text.safeParse(value).success
}

/** The strings in a list, such as a schema's `enum`. Anything that isn't a list has none. */
const stringsIn = z
  .array(z.unknown())
  .catch([])
  .transform((values) => values.filter(isText))

/** Answers already given by flags or a preset. The wizard asks only what's missing. */
export interface PartialAnswers {
  template?: string
  mode?: string
  name?: string
  /** Each answered question's add-ons, `[]` for no. */
  questions: Record<string, string[]>
  /** Add-ons no question offers. */
  extra?: string[]
  /** `--with`: added to the answer of the question that offers each, starting from its default, or to `extra`. */
  with: string[]
  /** `--without`: taken out of its question's answer. A question left with nothing is answered no. */
  without: string[]
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- options keyed by add-on id, as in Answers; each add-on's schema types its values
  options: Record<string, Record<string, unknown>>
  adopt?: boolean
}

export function emptyAnswers(): PartialAnswers {
  return { questions: {}, with: [], without: [], options: {} }
}

function offering(template: ExpandedTemplate, id: string): ExpandedQuestion | undefined {
  return template.questions.find((question) => question.choices.some((choice) => choice.id === id))
}

/** Combines answers without prompting: unanswered questions take their defaults in the planner. */
export function completeAnswers(catalog: CatalogManifest, partial: PartialAnswers): Answers {
  const templateId = partial.template ?? (catalog.templates.length === 1 ? catalog.templates[0]?.id : undefined)

  if (templateId === undefined) {
    throw new PlanError(
      "E_USAGE",
      `Choose a template: ${catalog.templates.map((candidate) => candidate.id).join(", ")}.`
    )
  }

  const template = requireTemplate(catalog, templateId)
  const questions = structuredClone(partial.questions)
  let extra = partial.extra

  for (const name of partial.with) {
    const id = requireAddonId(catalog, name)
    const question = offering(template, id)

    if (question) {
      const current = questions[question.id] ?? question.default
      questions[question.id] = question.pick === "one" ? [id] : [...new Set([...current, id])]
    } else {
      extra = [...new Set([...(extra ?? []), id])]
    }
  }

  for (const name of partial.without) {
    const id = requireAddonId(catalog, name)
    const question = offering(template, id)

    if (question) {
      questions[question.id] = (questions[question.id] ?? question.default).filter((entry) => entry !== id)
    } else {
      extra = extra?.filter((entry) => entry !== id)
    }
  }

  const answers: Answers = { template: templateId }

  if (partial.mode !== undefined) {
    answers.mode = partial.mode
  }

  if (partial.name !== undefined) {
    answers.name = partial.name
  }

  if (Object.keys(questions).length > 0) {
    answers.questions = questions
  }

  if (extra !== undefined && extra.length > 0) {
    answers.extra = extra
  }

  if (Object.keys(partial.options).length > 0) {
    answers.options = partial.options
  }

  if (partial.adopt) {
    answers.adopt = true
  }

  return answers
}

/**
 * Asks every question the flags left open, generated from the catalog in this order: template, project name, mode,
 * each of the template's questions, then the options each chosen add-on lists in `ask`. A question that isn't asked,
 * because of its `when` or because nothing is available, is skipped without a word.
 */
export async function runWizard(input: {
  catalog: CatalogManifest
  partial: PartialAnswers
  prompter: Prompter
  askName: boolean
}): Promise<Answers | Cancelled> {
  const { catalog, prompter } = input
  const partial: PartialAnswers = structuredClone(input.partial)

  if (partial.template === undefined) {
    const [only] = catalog.templates

    if (only && catalog.templates.length === 1) {
      partial.template = only.id
    } else {
      const answer = await prompter.select({
        message: "Which template?",
        options: catalog.templates.map((template) => ({
          value: template.id,
          label: template.title,
          hint: template.description
        }))
      })

      if (answer === cancelled) {
        return cancelled
      }

      partial.template = answer
    }
  }

  const template = requireTemplate(catalog, partial.template)

  if (input.askName && partial.name === undefined) {
    const answer = await prompter.text({
      message: "Project name?",
      placeholder: "my-app",
      validate: (value) => projectNameProblem(value.trim())
    })

    if (answer === cancelled) {
      return cancelled
    }

    partial.name = answer.trim()
  }

  const target = findTarget(catalog, template.target)

  if (partial.mode === undefined && template.modes.length > 1) {
    const answer = await prompter.select({
      message: "Which mode?",
      options: template.modes.map((mode) => ({
        value: mode,
        label: target?.modes.find((candidate) => candidate.id === mode)?.title ?? mode
      }))
    })

    if (answer === cancelled) {
      return cancelled
    }

    partial.mode = answer
  }

  partial.mode ??= template.modes[0]

  for (const question of template.questions) {
    const sofar = completeAnswers(catalog, partial)

    if (sofar.questions?.[question.id] !== undefined) {
      continue
    }

    const answer = await askQuestion(prompter, question, availableChoices(catalog, sofar, question.id))

    if (answer === cancelled) {
      return cancelled
    }

    if (answer !== undefined) {
      partial.questions[question.id] = answer
    }
  }

  const answers = completeAnswers(catalog, partial)
  const steps = walkQuestions(catalog, template, undefined, answers)
  const chosen = [...steps.flatMap((step) => step.answer), ...(answers.extra ?? [])]
  const options: NonNullable<Answers["options"]> = structuredClone(answers.options ?? {})

  for (const id of chosen) {
    const addon = findAddon(catalog, id)

    if (!addon) {
      continue
    }

    for (const question of optionQuestions(addon)) {
      if (options[id] && Object.hasOwn(options[id], question.key)) {
        continue
      }

      const value = await askOption(prompter, addon.title, question)

      if (value === cancelled) {
        return cancelled
      }

      options[id] = { ...options[id], [question.key]: value }
    }
  }

  return Object.keys(options).length > 0 ? { ...answers, options } : { ...answers }
}

/**
 * Asks one question: yes or no unless it's required, then which, unless one choice is available. An unavailable choice
 * is shown disabled, with its reason as the hint. `undefined` means it isn't asked.
 */
async function askQuestion(
  prompter: Prompter,
  question: ExpandedQuestion,
  available: ReturnType<typeof availableChoices>
): Promise<string[] | undefined | Cancelled> {
  if (!available.asked) {
    return undefined
  }

  const open = available.choices.filter((choice) => choice.disabled === undefined).map((choice) => choice.id)
  const defaults = question.default.filter((id) => open.includes(id))

  if (!question.required) {
    const wanted = await prompter.confirm({
      message: question.question ?? `Add ${question.title.toLowerCase()}?`,
      initialValue: defaults.length > 0
    })

    if (wanted === cancelled || !wanted) {
      return wanted === cancelled ? cancelled : []
    }
  }

  const [only] = open

  if (only !== undefined && open.length === 1) {
    return [only]
  }

  // An unavailable choice shows why in place of its hint.
  const options = available.choices.map((choice) => {
    const hint = choice.disabled ?? choice.hint
    const option: SelectOption = { value: choice.id, label: choice.label }

    if (hint) {
      option.hint = hint
    }

    if (choice.disabled !== undefined) {
      option.disabled = true
    }

    return option
  })

  const message = question.choose ?? `Which ${question.title.toLowerCase()}?`

  if (question.pick === "many") {
    return prompter.multiselect({ message, options, initialValues: defaults, required: true })
  }

  const select: SelectQuestion = { message, options }

  if (defaults[0] !== undefined) {
    select.initialValue = defaults[0]
  }

  const answer = await prompter.select(select)

  return answer === cancelled ? cancelled : [answer]
}

async function askOption(
  prompter: Prompter,
  title: string,
  question: OptionQuestion
): Promise<OptionAnswer | Cancelled> {
  const schema = question.schema
  const message = `${title}: ${question.title}`
  const items = isRecord(schema.items) ? schema.items : undefined

  if (schema.type === "boolean") {
    return prompter.confirm({ message, initialValue: question.default === true })
  }

  if (Array.isArray(schema.enum)) {
    const select: SelectQuestion = {
      message,
      options: stringsIn.parse(schema.enum).map((value) => ({ value, label: value }))
    }

    const initial = text.safeParse(question.default)

    if (initial.success) {
      select.initialValue = initial.data
    }

    return prompter.select(select)
  }

  if (schema.type === "array" && items && Array.isArray(items.enum)) {
    return prompter.multiselect({
      message,
      options: stringsIn.parse(items.enum).map((value) => ({ value, label: value })),
      initialValues: stringsIn.parse(question.default)
    })
  }

  let initial: string | undefined

  if (Array.isArray(question.default)) {
    initial = question.default.join(", ")
  } else if (question.default !== undefined) {
    initial = String(question.default)
  }

  const numeric = schema.type === "number" || schema.type === "integer"

  const textQuestion: TextQuestion = {
    message,
    validate: (value) => {
      if (!numeric) {
        return undefined
      }

      // Number("") is 0, so a blank answer has to be refused on its own.
      const parsed = Number(value)

      if (value.trim() === "" || !Number.isFinite(parsed)) {
        return "Enter a number."
      }

      return schema.type === "integer" && !Number.isInteger(parsed) ? "Enter a whole number." : undefined
    }
  }

  if (initial !== undefined) {
    textQuestion.initialValue = initial
  }

  const answer = await prompter.text(textQuestion)

  if (answer === cancelled) {
    return cancelled
  }

  if (numeric) {
    return Number(answer)
  }

  return schema.type === "array"
    ? answer
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : answer
}

/**
 * Asks for each environment variable, with a masked prompt for secrets. A required one needs a value, and its example
 * is the default. An optional one can be left blank, which writes it empty so later commands don't ask again. Values
 * go only to the secrets file.
 */
export async function askEnv(env: EnvVar[], prompter: Prompter): Promise<Record<string, string> | Cancelled> {
  const values: Record<string, string> = {}

  for (const variable of env) {
    // A help link goes on a second line of the prompt.
    const help = variable.help === undefined ? "" : `\nGet one at ${variable.help}`
    const message = `${variable.name}: ${variable.description}${variable.required ? "" : " (optional, press Enter to skip)"}${help}`

    const validate = (value: string) =>
      variable.required && value.trim() === "" ? "Enter a value, or press Ctrl+C to stop." : undefined

    const textQuestion: TextQuestion = { message, validate }

    if (variable.example !== undefined) {
      textQuestion.placeholder = variable.example

      if (variable.required) {
        textQuestion.initialValue = variable.example
      }
    }

    const answer = variable.secret ? await prompter.password({ message, validate }) : await prompter.text(textQuestion)

    if (answer === cancelled) {
      return cancelled
    }

    values[variable.name] = answer.trim()
  }

  return values
}
