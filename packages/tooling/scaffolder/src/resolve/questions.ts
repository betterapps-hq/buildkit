import { z } from "zod"
import {
  allAddons,
  expandTemplate,
  findAddon,
  findMode,
  findTarget,
  parseOptions,
  targetInfo,
  type ExpandedChoice,
  type ExpandedQuestion,
  type ExpandedTemplate
} from "../manifest/catalog.js"
import type {
  AddonManifest,
  AddonReference,
  Answers,
  CatalogManifest,
  Condition,
  Gallery,
  TargetInfo
} from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { isRecord, isString } from "../plan/json.js"
import { addonsConflict, addonSupports, requireAddonId } from "./resolve.js"

export interface ChoiceDescription {
  /** An add-on id, or `npm:<name>`. */
  id: string
  label: string
  hint?: string
}

export interface QuestionDescription {
  id: string
  title: string
  question?: string
  choose?: string
  pick: "one" | "many"
  required: boolean
  default: string[]
  when?: Condition
  /** Those that support the mode. Which can be picked depends on earlier answers: see `availableChoices`. */
  choices: ChoiceDescription[]
}

export interface AvailableChoice extends ChoiceDescription {
  /** Why it can't be picked now, such as "Needs Drizzle or Prisma" or "Can't be used with Convex". */
  disabled?: string
}

export interface OptionQuestion {
  addon: string
  key: string
  title: string
  /** JSON Schema of the option. */
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- a JSON Schema from Zod, whose keywords hold any JSON
  schema: Record<string, unknown>
  default?: unknown
}

export interface TemplateDescription {
  id: string
  title: string
  description: string
  extends?: string
  modes: { id: string; title: string }[]
  /** Installed every time, never asked about. */
  required: ChoiceDescription[]
  questionsByMode: Record<string, QuestionDescription[]>
  /** With `stack`: the titles of what a project gets with every default answer, in the first mode. */
  gallery: Gallery & { stack: string[] }
}

export interface CatalogDescription {
  catalog: { id: string; version: string }
  templates: TemplateDescription[]
  /** The add-ons and their rules, so another door can explain a choice without the engine. */
  addons: {
    id: string
    title: string
    description: string
    version: string
    /** The capabilities it provides. */
    provides: string[]
    requires: string[]
    conflicts: string[]
    joins?: string[]
    ask: OptionQuestion[]
    /** JSON Schema of its options. */
    // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- a JSON Schema from Zod, whose keywords hold any JSON
    options: Record<string, unknown>
  }[]
  /** Each preset's saved answers, so other doors can show or apply them without the catalog. */
  presets: { id: string; title: string; template: string; answers: Omit<Answers, "name"> }[]
}

/** Whether a question is asked now, and its choices with the ones that can't be picked disabled. */
export interface QuestionAvailability {
  asked: boolean
  choices: AvailableChoice[]
}

/** One question of a template, worked out from the answers before it. */
export interface QuestionStep {
  question: ExpandedQuestion
  /** Whether its `when` holds for what's selected before it. */
  holds: boolean
  /** Whether it's asked: its `when` holds and a choice is available. */
  asked: boolean
  /** The choices that support the mode, each disabled with a reason when it can't be picked. */
  choices: AvailableChoice[]
  /** Whether the answers answer it. */
  explicit: boolean
  /** The add-on ids it selects: its answer, else its available default, else its only choice when it's required. */
  answer: string[]
  /** A required question that needs a pick: its available choices. */
  choose?: string[]
}

function provides(addon: AddonManifest, capability: string): boolean {
  return addon.provides !== undefined && Object.hasOwn(addon.provides, capability)
}

/** Whether a reference, an add-on id or `provides:<name>`, matches something selected. */
export function referenceMatches(reference: AddonReference, selected: readonly AddonManifest[]): boolean {
  return reference.startsWith("provides:")
    ? selected.some((addon) => provides(addon, reference.slice(9)))
    : selected.some((addon) => addon.id === reference)
}

function holds(condition: Condition | undefined, selected: readonly AddonManifest[]): boolean {
  return (
    (condition?.selected ?? []).every((reference) => referenceMatches(reference, selected)) &&
    !(condition?.notSelected ?? []).some((reference) => referenceMatches(reference, selected))
  )
}

/** The add-ons with these ids and everything they pull in through `requires`. Unknown ids are left out. */
export function pulledIn(catalog: CatalogManifest, ids: Iterable<string>): AddonManifest[] {
  const found = new Map<string, AddonManifest>()

  const visit = (id: string) => {
    const addon = found.has(id) ? undefined : findAddon(catalog, id)

    if (!addon) {
      return
    }

    found.set(id, addon)

    for (const requirement of addon.requires ?? []) {
      if (!requirement.startsWith("provides:")) {
        visit(requirement)
      }
    }
  }

  for (const id of ids) {
    visit(id)
  }

  return [...found.values()]
}

/** "A", "A or B", "A, B or C". */
function listText(items: readonly string[], conjunction: string): string {
  const last = items.at(-1) ?? ""

  return items.length > 1 ? `${items.slice(0, -1).join(", ")} ${conjunction} ${last}` : last
}

/** The template's choices that provide a capability, by title, or the capability's name when none do. */
function providerText(catalog: CatalogManifest, template: ExpandedTemplate, capability: string): string {
  const titles = template.questions
    .flatMap((question) => question.choices)
    .map((choice) => findAddon(catalog, choice.id))
    .filter((addon) => addon !== undefined && provides(addon, capability))
    .map((addon) => addon?.title ?? "")

  return titles.length === 0 ? `an add-on that provides ${capability}` : listText([...new Set(titles)], "or")
}

/**
 * Why a choice can't be picked with what's selected: it, or an add-on it pulls in, conflicts with something selected,
 * or needs `provides:<name>` that nothing selected or pulled in provides.
 */
function unavailable(
  catalog: CatalogManifest,
  template: ExpandedTemplate,
  selected: readonly AddonManifest[],
  id: string
): string | undefined {
  const own = pulledIn(catalog, [id])
  const clash = selected.find((other) => own.some((addon) => addon.id !== other.id && addonsConflict(addon, other)))

  if (clash) {
    return `Can't be used with ${clash.title}`
  }

  const all = [...selected, ...own]

  for (const addon of own) {
    for (const requirement of addon.requires ?? []) {
      if (requirement.startsWith("provides:") && !referenceMatches(requirement, all)) {
        return `Needs ${providerText(catalog, template, requirement.slice(9))}`
      }
    }
  }

  return undefined
}

function describeChoice(catalog: CatalogManifest, choice: ExpandedChoice): ChoiceDescription {
  const addon = findAddon(catalog, choice.id)
  const hint = choice.hint ?? addon?.description

  const described: ChoiceDescription = { id: choice.id, label: choice.label ?? addon?.title ?? choice.id }

  if (hint) {
    described.hint = hint
  }

  return described
}

function supportedChoices(
  catalog: CatalogManifest,
  question: ExpandedQuestion,
  info: TargetInfo | undefined
): ExpandedChoice[] {
  return question.choices.filter((choice) => {
    const addon = findAddon(catalog, choice.id)

    return !addon || !info || addonSupports(addon, info) === true
  })
}

/** A question's choices that support the mode, each disabled with the reason when it can't go with `selected`. */
export function questionChoices(
  catalog: CatalogManifest,
  template: ExpandedTemplate,
  question: ExpandedQuestion,
  info: TargetInfo | undefined,
  selected: readonly AddonManifest[]
): AvailableChoice[] {
  return supportedChoices(catalog, question, info).map((choice): AvailableChoice => {
    const reason = unavailable(catalog, template, selected, choice.id)
    const available: AvailableChoice = describeChoice(catalog, choice)

    if (reason !== undefined) {
      available.disabled = reason
    }

    return available
  })
}

/** A question's explicit answer as add-on ids, checked against what it offers. */
function checkedAnswer(
  catalog: CatalogManifest,
  template: ExpandedTemplate,
  question: ExpandedQuestion,
  given: readonly string[]
): string[] {
  if (given.length === 0) {
    if (question.required) {
      throw new PlanError(
        "E_USAGE",
        `${template.title} needs a ${question.title.toLowerCase()}, so "no" isn't an answer.`
      )
    }

    return []
  }

  const ids = [...new Set(given.map((name) => requireAddonId(catalog, name)))]
  const offered = question.choices.map((choice) => choice.id)

  for (const id of ids) {
    if (!offered.includes(id)) {
      throw new PlanError(
        "E_USAGE",
        `${id} isn't a choice for ${question.title.toLowerCase()}. Choose ${listText(offered, "or")}.`
      )
    }
  }

  if (question.pick === "one" && ids.length > 1) {
    throw new PlanError("E_USAGE", `${question.title} takes one answer, not ${ids.join(", ")}.`)
  }

  return ids
}

/**
 * Works out a template's questions in order from the answers. What's selected before a question is the required
 * add-ons, the answers to earlier questions (or their defaults when unanswered), and everything those pull in. With
 * `stop`, the walk ends at that question, so later answers don't count.
 */
export function walkQuestions(
  catalog: CatalogManifest,
  template: ExpandedTemplate,
  info: TargetInfo | undefined,
  answers: Pick<Answers, "questions">,
  stop?: string
): QuestionStep[] {
  const selected = [...template.required]
  const steps: QuestionStep[] = []

  for (const question of template.questions) {
    const before = pulledIn(catalog, selected)
    const choices = questionChoices(catalog, template, question, info, before)
    const available = choices.filter((choice) => choice.disabled === undefined).map((choice) => choice.id)
    const condition = holds(question.when, before)

    const step: QuestionStep = {
      question,
      holds: condition,
      asked: condition && available.length > 0,
      choices,
      explicit: false,
      answer: []
    }

    steps.push(step)

    if (question.id === stop) {
      break
    }

    const given = answers.questions?.[question.id]

    if (given !== undefined) {
      step.explicit = true
      step.answer = checkedAnswer(catalog, template, question, given)
    } else if (step.asked) {
      const defaults = question.default.filter((id) => available.includes(id))

      if (defaults.length > 0) {
        step.answer = defaults
      } else if (question.required && available.length === 1) {
        step.answer = available
      } else if (question.required) {
        step.choose = available
      }
    }

    selected.push(...step.answer)
  }

  return steps
}

/** The template, its target info in a mode, or `E_UNKNOWN_TEMPLATE`. */
export function requireTemplate(catalog: CatalogManifest, id: string): ExpandedTemplate {
  const template = expandTemplate(catalog, id)

  if (!template) {
    throw new PlanError("E_UNKNOWN_TEMPLATE", `There's no template named "${id}".`, {
      next: catalog.templates.map((candidate) => candidate.id)
    })
  }

  return template
}

function modeInfo(catalog: CatalogManifest, template: ExpandedTemplate, modeId: string): TargetInfo | undefined {
  const target = findTarget(catalog, template.target)
  const mode = target ? findMode(target, modeId) : undefined

  return target && mode ? targetInfo(catalog, target, mode) : undefined
}

/** A template's questions in one mode, after `extends`, `use` and `omit`, in the order they're asked. */
export function templateQuestions(catalog: CatalogManifest, template: string, mode: string): QuestionDescription[] {
  const expanded = requireTemplate(catalog, template)
  const info = modeInfo(catalog, expanded, mode)

  return expanded.questions.map((question) => {
    // Built in parts, so the optional fields keep their place in `catalog --json`.
    const asking: Pick<QuestionDescription, "id" | "title" | "question" | "choose"> = {
      id: question.id,
      title: question.title
    }

    if (question.question !== undefined) {
      asking.question = question.question
    }

    if (question.choose !== undefined) {
      asking.choose = question.choose
    }

    const condition: Pick<QuestionDescription, "when"> = {}

    if (question.when !== undefined) {
      condition.when = question.when
    }

    return {
      ...asking,
      pick: question.pick,
      required: question.required,
      default: question.default,
      ...condition,
      choices: supportedChoices(catalog, question, info).map((choice) => describeChoice(catalog, choice))
    }
  })
}

/**
 * Whether the question is asked, given the answers so far, and which of its choices can be picked. A question with no
 * choice available, or whose `when` doesn't hold, isn't asked.
 */
export function availableChoices(catalog: CatalogManifest, answers: Answers, question: string): QuestionAvailability {
  const template = requireTemplate(catalog, answers.template)

  if (!template.questions.some((candidate) => candidate.id === question)) {
    throw new PlanError("E_USAGE", `${template.title} has no question "${question}".`)
  }

  const info = modeInfo(catalog, template, answers.mode ?? template.modes[0] ?? "")
  const step = walkQuestions(catalog, template, info, answers, question).at(-1)

  return { asked: step?.asked ?? false, choices: step?.choices ?? [] }
}

/** JSON Schema for an add-on's options, or an empty object schema when it has none. */
// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- a JSON Schema from Zod, whose keywords hold any JSON
export function optionsSchema(addon: AddonManifest): Record<string, unknown> {
  if (!addon.options) {
    // oxlint-disable-next-line anti-slop/no-known-value-widening -- the empty schema is one value of the JSON Schema this returns
    return { type: "object", properties: {}, additionalProperties: false }
  }

  const schema: unknown = z.toJSONSchema(addon.options, { io: "input", unrepresentable: "any" })

  return isRecord(schema) ? schema : {}
}

/** The options an add-on asks about, with their schemas and defaults. */
export function optionQuestions(addon: AddonManifest): OptionQuestion[] {
  const schema = optionsSchema(addon)
  const properties = isRecord(schema.properties) ? schema.properties : {}
  const defaults = parseOptions(addon, {})

  return (addon.ask ?? []).flatMap((key) => {
    const property = properties[key]

    if (!isRecord(property)) {
      return []
    }

    const fallback = defaults.ok ? defaults.value[key] : undefined

    const option: OptionQuestion = {
      addon: addon.id,
      key,
      title: isString(property.description) ? property.description : key,
      schema: property
    }

    if (fallback !== undefined) {
      option.default = fallback
    }

    return [option]
  })
}

/** A template for `catalog --json` and the gallery, with its questions in each mode. */
export function describeTemplate(catalog: CatalogManifest, id: string): TemplateDescription {
  const template = requireTemplate(catalog, id)
  const target = findTarget(catalog, template.target)
  const [first = ""] = template.modes
  // The stack is what a project gets with every default answer, without the glue between add-ons.
  const steps = walkQuestions(catalog, template, modeInfo(catalog, template, first), {})

  const stack = [...template.required, ...steps.flatMap((step) => step.answer)].flatMap((addonId) => {
    const addon = findAddon(catalog, addonId)

    return addon && addon.joins === undefined ? [addon.title] : []
  })

  // Built in parts, so `extends` keeps its place in `catalog --json`.
  const naming: Pick<TemplateDescription, "id" | "title" | "description" | "extends"> = {
    id: template.id,
    title: template.title,
    description: template.description
  }

  if (template.extends !== undefined) {
    naming.extends = template.extends
  }

  return {
    ...naming,
    modes: template.modes.map((mode) => ({
      id: mode,
      title: target?.modes.find((candidate) => candidate.id === mode)?.title ?? mode
    })),
    required: template.required.map((addonId) => describeChoice(catalog, { id: addonId })),
    questionsByMode: Object.fromEntries(template.modes.map((mode) => [mode, templateQuestions(catalog, id, mode)])),
    gallery: { ...template.gallery, stack: [...new Set(stack)] }
  }
}

/** Everything the wizard can ask, for `catalog --json`, the dashboard and agents. */
export function describeCatalog(catalog: CatalogManifest): CatalogDescription {
  return {
    catalog: { id: catalog.id, version: catalog.version },
    templates: catalog.templates.map((template) => describeTemplate(catalog, template.id)),
    addons: allAddons(catalog).map((addon) => {
      // Built in parts, so `joins` keeps its place in `catalog --json`.
      const rules: Pick<CatalogDescription["addons"][number], "joins"> = {}

      if (addon.joins) {
        rules.joins = addon.joins
      }

      return {
        id: addon.id,
        title: addon.title,
        description: addon.description,
        version: addon.version,
        provides: Object.keys(addon.provides ?? {}),
        requires: addon.requires ?? [],
        conflicts: addon.conflicts ?? [],
        ...rules,
        ask: optionQuestions(addon),
        options: optionsSchema(addon)
      }
    }),
    presets: (catalog.presets ?? []).map((preset) => ({
      id: preset.id,
      title: preset.title,
      template: preset.answers.template,
      answers: preset.answers
    }))
  }
}
