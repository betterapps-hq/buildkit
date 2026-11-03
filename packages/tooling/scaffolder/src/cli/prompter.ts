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
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- clack types a cancelled prompt as any symbol, so isCancel leaves it in the type
  return typeof value === "symbol" ? cancelled : value
}

function clackOption(option: SelectOption): prompts.Option<string> {
  const shown: prompts.Option<string> = { value: option.value, label: option.label }

  if (option.hint) {
    shown.hint = option.hint
  }

  if (option.disabled) {
    shown.disabled = true
  }

  return shown
}

/** Clack's `validate`, which gets `undefined` for empty input, as the wizard's, which gets text. */
function clackValidate(validate: (value: string) => string | undefined) {
  return (value: string | undefined) => validate(value ?? "")
}

export const clackPrompter: Prompter = {
  async select(question) {
    const options: prompts.SelectOptions<string> = {
      message: question.message,
      options: question.options.map(clackOption)
    }

    if (question.initialValue !== undefined) {
      options.initialValue = question.initialValue
    }

    return unwrap<string>(await prompts.select(options))
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
    const options: prompts.TextOptions = { message: question.message }

    if (question.placeholder !== undefined) {
      options.placeholder = question.placeholder
    }

    if (question.initialValue !== undefined) {
      options.initialValue = question.initialValue
    }

    if (question.validate) {
      options.validate = clackValidate(question.validate)
    }

    return unwrap<string>(await prompts.text(options))
  },
  async password(question) {
    const options: prompts.PasswordOptions = { message: question.message }

    if (question.validate) {
      options.validate = clackValidate(question.validate)
    }

    return unwrap<string>(await prompts.password(options))
  },
  note(message, title) {
    prompts.note(message, title)
  }
}
