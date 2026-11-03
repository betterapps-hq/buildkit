import * as prompts from "@clack/prompts"

/** Returned by a prompt the user cancelled, for example with Ctrl+C. */
export const cancelled: unique symbol = Symbol("cancelled")
export type Cancelled = typeof cancelled

export interface SelectOption {
  value: string
  label: string
  hint?: string
  /** Shown and not selectable, such as a choice another answer rules out. */
  disabled?: boolean
}

/** The prompts the wizard uses. Tests pass a scripted prompter; the CLI uses clack. */
export interface Prompter {
  select(question: { message: string; options: SelectOption[]; initialValue?: string }): Promise<string | Cancelled>
  multiselect(question: {
    message: string
    options: SelectOption[]
    initialValues: string[]
    /** At least one has to be picked. */
    required?: boolean
  }): Promise<string[] | Cancelled>
  confirm(question: { message: string; initialValue: boolean }): Promise<boolean | Cancelled>
  text(question: {
    message: string
    placeholder?: string
    initialValue?: string
    validate?: (value: string) => string | undefined
  }): Promise<string | Cancelled>
  password(question: { message: string; validate?: (value: string) => string | undefined }): Promise<string | Cancelled>
  note(message: string, title: string): void
}

function unwrap<T extends string | boolean | string[]>(value: T | symbol): T | Cancelled {
  return typeof value === "symbol" ? cancelled : value
}

function clackOption(option: SelectOption) {
  return {
    value: option.value,
    label: option.label,
    ...(option.hint ? { hint: option.hint } : {}),
    ...(option.disabled ? { disabled: true } : {})
  }
}

export const clackPrompter: Prompter = {
  async select(question) {
    return unwrap<string>(
      await prompts.select({
        message: question.message,
        options: question.options.map(clackOption),
        ...(question.initialValue === undefined ? {} : { initialValue: question.initialValue })
      })
    )
  },
  async multiselect(question) {
    return unwrap<string[]>(
      await prompts.multiselect({
        message: question.message,
        required: question.required === true,
        initialValues: question.initialValues,
        options: question.options.map(clackOption)
      })
    )
  },
  async confirm(question) {
    return unwrap<boolean>(await prompts.confirm({ message: question.message, initialValue: question.initialValue }))
  },
  async text(question) {
    const validate = question.validate
    return unwrap<string>(
      await prompts.text({
        message: question.message,
        ...(question.placeholder === undefined ? {} : { placeholder: question.placeholder }),
        ...(question.initialValue === undefined ? {} : { initialValue: question.initialValue }),
        ...(validate ? { validate: (value: string | undefined) => validate(value ?? "") } : {})
      })
    )
  },
  async password(question) {
    const validate = question.validate
    return unwrap<string>(
      await prompts.password({
        message: question.message,
        ...(validate ? { validate: (value: string | undefined) => validate(value ?? "") } : {})
      })
    )
  },
  note(message, title) {
    prompts.note(message, title)
  }
}
