import { PlanError } from "../plan/errors.js"
import { isRecord, isString } from "../plan/json.js"
import { isValidVersion } from "../upgrade/semver.js"
import type {
  AddonManifest,
  AddonRef,
  Answers,
  CatalogManifest,
  Contribution,
  Choice,
  Condition,
  Gallery,
  PackageAddon,
  PackRecord,
  PresetManifest,
  QuestionDefinition,
  QuestionUse,
  TargetInfo,
  TargetManifest,
  TargetMode,
  TemplateManifest
} from "./types.js"

/** A question's choice after expansion: an add-on id, or `npm:<name>` for a bare add-on. */
export interface ExpandedChoice {
  id: string
  label?: string
  hint?: string
}

/** A question as a template asks it, after `use` applied this template's changes. */
export interface ExpandedQuestion {
  id: string
  title: string
  question?: string
  choose?: string
  pick: "one" | "many"
  required: boolean
  /** Add-on ids. One at most for a `one` question. */
  default: string[]
  when?: Condition
  choices: ExpandedChoice[]
}

/** A template after `extends`, `use` and `omit`. Every step after loading reads templates this way. */
export interface ExpandedTemplate {
  id: string
  title: string
  description: string
  extends?: string
  target: string
  /** Its own, else the parent's, else every mode of the target. */
  modes: string[]
  /** Add-on ids, with `npm:<name>` for bare add-ons, the parent's first. */
  required: string[]
  /** In the order they're asked. */
  questions: ExpandedQuestion[]
  gallery?: Gallery
}

export function findAddon(catalog: CatalogManifest, id: string): AddonManifest | undefined {
  return (
    catalog.addons.find((addon) => addon.id === id) ?? (id.startsWith("npm:") ? bareAddons(catalog).get(id) : undefined)
  )
}

/** The catalog's add-ons and the bare add-ons its templates and questions name. */
export function allAddons(catalog: CatalogManifest): AddonManifest[] {
  return [...catalog.addons, ...bareAddons(catalog).values()]
}

interface BareAddons {
  templates: readonly TemplateManifest[]
  questions: readonly QuestionDefinition[] | undefined
  addons: Map<string, AddonManifest>
}

const bareCache = new WeakMap<CatalogManifest, BareAddons>()

/** The id a template uses for an add-on it installs or offers: `npm:<name>` for a bare add-on. */
export function addonRefId(ref: AddonRef | Choice): string {
  if (isString(ref)) {
    return ref
  }

  return "npm" in ref ? `npm:${ref.npm}` : ref.addon
}

function packageAddon(details: PackageAddon): AddonManifest {
  return {
    id: `npm:${details.npm}`,
    version: "0.0.0",
    title: details.title ?? details.npm,
    description: details.description ?? "",
    contribute: (ctx) => {
      const dependency: Extract<Contribution, { kind: "dependency" }> = {
        kind: "dependency",
        name: details.npm,
        version: ctx.version(details.npm)
      }

      if (details.dev) {
        dependency.dev = true
      }

      return [dependency]
    }
  }
}

/**
 * Every bare add-on a catalog's templates and questions name, made once per catalog: one dependency at the catalog's
 * pin. When two places give the same package different details, the last one wins, and the catalog check reports it.
 */
export function bareAddons(catalog: CatalogManifest): Map<string, AddonManifest> {
  const cached = bareCache.get(catalog)

  if (cached && cached.templates === catalog.templates && cached.questions === catalog.questions) {
    return cached.addons
  }

  const addons = new Map<string, AddonManifest>()

  for (const ref of packageRefs(catalog)) {
    if (!isString(ref)) {
      addons.set(`npm:${ref.npm}`, packageAddon(ref))
    } else if (!addons.has(ref)) {
      addons.set(ref, packageAddon({ npm: ref.slice(4) }))
    }
  }

  bareCache.set(catalog, { templates: catalog.templates, questions: catalog.questions, addons })

  return addons
}

/** Every place a catalog names a bare add-on, in order: `npm:<name>`, or the details a template gives. */
export function packageRefs(catalog: CatalogManifest): (string | PackageAddon)[] {
  const refs: (string | PackageAddon)[] = []

  const see = (ref: AddonRef | Choice) => {
    if (isString(ref)) {
      if (ref.startsWith("npm:")) {
        refs.push(ref)
      }
    } else if ("npm" in ref) {
      refs.push(ref)
    }
  }

  for (const question of catalog.questions ?? []) {
    question.choices.forEach(see)
  }

  for (const template of catalog.templates) {
    template.required?.forEach(see)

    for (const entry of template.questions ?? []) {
      if (!isString(entry)) {
        entry.choices?.forEach(see)
      }
    }
  }

  return refs
}

export function findQuestion(catalog: CatalogManifest, id: string): QuestionDefinition | undefined {
  return (catalog.questions ?? []).find((question) => question.id === id)
}

function expandChoice(choice: Choice): ExpandedChoice {
  if (isString(choice)) {
    return { id: choice }
  }

  const expanded: ExpandedChoice = { id: "npm" in choice ? `npm:${choice.npm}` : choice.addon }

  if (!("npm" in choice) && choice.label !== undefined) {
    expanded.label = choice.label
  }

  if (choice.hint !== undefined) {
    expanded.hint = choice.hint
  }

  return expanded
}

function expandQuestion(question: QuestionDefinition): ExpandedQuestion {
  const expanded: ExpandedQuestion = {
    id: question.id,
    title: question.title,
    pick: question.pick,
    required: question.required === true,
    default: question.default === undefined ? [] : [question.default].flat(),
    choices: question.choices.map(expandChoice)
  }

  if (question.question !== undefined) {
    expanded.question = question.question
  }

  if (question.choose !== undefined) {
    expanded.choose = question.choose
  }

  if (question.when !== undefined) {
    expanded.when = question.when
  }

  return expanded
}

/**
 * A template after `extends`, `use` and `omit`, or `undefined` when there's no template with the id. A parent that
 * doesn't exist, a cycle, or a question that isn't defined is an `E_INVALID_CATALOG` error, which the catalog check
 * reports first.
 */
export function expandTemplate(catalog: CatalogManifest, id: string): ExpandedTemplate | undefined {
  return expand(catalog, id, [])
}

function expand(catalog: CatalogManifest, id: string, chain: readonly string[]): ExpandedTemplate | undefined {
  const template = findTemplate(catalog, id)

  if (!template) {
    return undefined
  }

  if (chain.includes(id)) {
    throw new PlanError("E_INVALID_CATALOG", `Templates extend each other in a cycle: ${[...chain, id].join(", ")}.`)
  }

  const parent = template.extends === undefined ? undefined : expand(catalog, template.extends, [...chain, id])

  if (template.extends !== undefined && !parent) {
    throw new PlanError("E_INVALID_CATALOG", `Template ${id} extends ${template.extends}, which isn't in the catalog.`)
  }

  const target = template.target ?? parent?.target

  if (target === undefined) {
    throw new PlanError("E_INVALID_CATALOG", `Template ${id} has no target, and extends no template.`)
  }

  const omit = new Set(template.omit ?? [])

  const required = [
    ...new Set([
      ...(parent?.required ?? []).filter((ref) => !omit.has(ref)),
      ...(template.required ?? []).map(addonRefId)
    ])
  ]

  const questions = (parent?.questions ?? []).filter((question) => !omit.has(question.id))

  for (const entry of template.questions ?? []) {
    const question = expandEntry(catalog, id, entry, questions)
    const index = questions.findIndex((candidate) => candidate.id === question.id)

    if (index === -1) {
      questions.push(question)
    } else {
      questions[index] = question
    }
  }

  const expanded: ExpandedTemplate = {
    id: template.id,
    title: template.title,
    description: template.description,
    target,
    modes: template.modes ?? parent?.modes ?? findTarget(catalog, target)?.modes.map((mode) => mode.id) ?? [],
    required,
    questions
  }

  if (template.extends !== undefined) {
    expanded.extends = template.extends
  }

  if (template.gallery !== undefined) {
    expanded.gallery = template.gallery
  }

  return expanded
}

/** One of a template's `questions` entries: a catalog or parent question by id, one changed by `use`, or its own. */
function expandEntry(
  catalog: CatalogManifest,
  template: string,
  entry: string | QuestionUse | QuestionDefinition,
  inherited: readonly ExpandedQuestion[]
): ExpandedQuestion {
  if (!isString(entry) && !("use" in entry)) {
    return expandQuestion(entry)
  }

  const id = isString(entry) ? entry : entry.use
  const own = findQuestion(catalog, id)
  const base = inherited.find((question) => question.id === id) ?? (own ? expandQuestion(own) : undefined)

  if (!base) {
    throw new PlanError("E_INVALID_CATALOG", `Template ${template} asks question ${id}, which isn't in the catalog.`)
  }

  if (isString(entry)) {
    return base
  }

  const used: ExpandedQuestion = { ...base }

  if (entry.choices !== undefined) {
    used.choices = entry.choices.map(expandChoice)
  }

  if (entry.default !== undefined) {
    used.default = [entry.default].flat()
  }

  if (entry.required !== undefined) {
    used.required = entry.required
  }

  if (entry.when !== undefined) {
    used.when = entry.when
  }

  return used
}

export function findTarget(catalog: CatalogManifest, id: string): TargetManifest | undefined {
  return catalog.targets.find((target) => target.id === id)
}

export function findTemplate(catalog: CatalogManifest, id: string): TemplateManifest | undefined {
  return catalog.templates.find((template) => template.id === id)
}

export function findPreset(catalog: CatalogManifest, id: string): PresetManifest | undefined {
  return (catalog.presets ?? []).find((preset) => preset.id === id)
}

/**
 * The catalog's pins as it writes them into `package.json`: an exact pin in its `range` style, such as `^19.3.1` in a
 * `caret` catalog, and a pin that's already a range as it is.
 */
export function writtenVersions(catalog: CatalogManifest): Record<string, string> {
  const prefix = { exact: "", caret: "^", tilde: "~" }[catalog.range ?? "exact"]

  return Object.fromEntries(
    Object.entries(catalog.versions ?? {}).map(([name, pin]) => [name, isValidVersion(pin) ? `${prefix}${pin}` : pin])
  )
}

export function findMode(target: TargetManifest, mode: string): TargetMode | undefined {
  return target.modes.find((candidate) => candidate.id === mode)
}

export function targetInfo(catalog: CatalogManifest, target: TargetManifest, mode: TargetMode): TargetInfo {
  const facets = new Set(mode.facets)

  return {
    id: target.id,
    family: target.family,
    mode: mode.id,
    renderModel: mode.renderModel,
    has(facet) {
      if (!catalog.facets.includes(facet)) {
        throw new Error(`Facet "${facet}" isn't registered in catalog ${catalog.id}.`)
      }

      return facets.has(facet)
    }
  }
}

/** The part of an add-on id after its scope: `@buildkit/db-d1` is `db-d1`. */
export function shortName(id: string): string {
  const slash = id.lastIndexOf("/")

  return slash === -1 ? id : id.slice(slash + 1)
}

export type NameLookup = { id: string } | { suggestions: string[]; ambiguous: boolean }

/**
 * Resolves an add-on id, its short name, or a bare add-on's package name (`zod` for `npm:zod`). An unknown or
 * ambiguous name comes back with suggestions.
 */
export function lookupAddon(catalog: CatalogManifest, name: string): NameLookup {
  if (findAddon(catalog, name)) {
    return { id: name }
  }

  if (bareAddons(catalog).has(`npm:${name}`)) {
    return { id: `npm:${name}` }
  }

  const matches = catalog.addons.filter((addon) => shortName(addon.id) === name)
  const [only] = matches

  if (only && matches.length === 1) {
    return { id: only.id }
  }

  if (matches.length > 1) {
    return { suggestions: matches.map((addon) => addon.id).sort(), ambiguous: true }
  }

  const wanted = shortName(name)

  const suggestions = catalog.addons
    .map((addon) => addon.id)
    .filter((id) => {
      const short = shortName(id)

      return short.includes(wanted) || wanted.includes(short) || editDistance(short, wanted) <= 2
    })
    .sort()

  return { suggestions, ambiguous: false }
}

/** One add-on's options, keyed by option name, as answers hold them. */
type AddonOptions = NonNullable<Answers["options"]>[string]

export type OptionsResult = { ok: true; value: AddonOptions } | { ok: false; issues: string[] }

/** Validates raw options against the add-on's schema, filling defaults. */
export function parseOptions(addon: AddonManifest, raw: AddonOptions | undefined): OptionsResult {
  const input = raw ?? {}

  if (!addon.options) {
    const keys = Object.keys(input)

    return keys.length === 0
      ? { ok: true, value: {} }
      : { ok: false, issues: keys.map((key) => `${key}: unknown option`) }
  }

  const result = addon.options.safeParse(input)

  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => `${issue.path.map(String).join(".") || "(options)"}: ${issue.message}`)
    }
  }

  const value: unknown = result.data

  return isRecord(value) ? { ok: true, value } : { ok: false, issues: ["(options): options must be an object"] }
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let row = 1; row <= left.length; row++) {
    const current = [row]

    for (let column = 1; column <= right.length; column++) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      current.push(
        Math.min((previous[column] ?? 0) + 1, (current[column - 1] ?? 0) + 1, (previous[column - 1] ?? 0) + cost)
      )
    }

    previous = current
  }

  return previous[right.length] ?? 0
}

/** The template package a catalog template comes from: `<package>#<id>`. Built-in templates have none. */
export function packOf(templateId: string): string | undefined {
  const hash = templateId.indexOf("#")

  return hash === -1 ? undefined : templateId.slice(0, hash)
}

/** Whether two catalogs, or a catalog and a lock, record the same catalog version and the same pack versions. */
export function sameCatalogVersion(
  left: { version: string; packs?: Record<string, PackRecord> | undefined },
  right: { version: string; packs?: Record<string, PackRecord> | undefined }
): boolean {
  const versions = (packs: Record<string, PackRecord> | undefined) =>
    Object.entries(packs ?? {})
      .map(([name, pack]) => `${name}@${pack.version}`)
      .sort()
      .join(" ")

  return left.version === right.version && versions(left.packs) === versions(right.packs)
}

/** `1.0.0`, or `1.0.0 with @acme/tower-defense@1.2.0` when packs are merged in. */
export function catalogVersionText(catalog: {
  version: string
  packs?: Record<string, PackRecord> | undefined
}): string {
  const packs = Object.entries(catalog.packs ?? {}).map(([name, pack]) => `${name}@${pack.version}`)

  return packs.length === 0 ? catalog.version : `${catalog.version} with ${packs.sort().join(", ")}`
}
