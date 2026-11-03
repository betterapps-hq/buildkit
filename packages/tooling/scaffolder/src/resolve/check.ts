import {
  expandTemplate,
  findAddon,
  findMode,
  findQuestion,
  findTarget,
  findTemplate,
  packageRefs,
  packOf,
  parseOptions,
  targetInfo,
  type ExpandedTemplate
} from "../manifest/catalog.js"
import type { Answers, CatalogManifest, RangeStyle, TemplateManifest } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { isRecord, isString } from "../plan/json.js"
import { render } from "../plan/render.js"
import { defineSettings } from "../state/settings.js"
import { compareVersions, isValidRange, isValidVersion, lowestVersion, satisfiesRange } from "../upgrade/semver.js"
import { selectionFromAnswers } from "./answers.js"
import { optionsSchema, pulledIn, referenceMatches } from "./questions.js"
import { addonsConflict, addonSupports, resolveSelection } from "./resolve.js"

const rangeStyles: readonly RangeStyle[] = ["exact", "caret", "tilde"]

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()

  for (const id of ids) {
    if (seen.has(id)) {
      repeated.add(id)
    }

    seen.add(id)
  }

  return [...repeated]
}

export interface CheckOptions {
  /** Plan every pair of answers for each template and mode. */
  matrix?: boolean
  /** The templates the matrix plans. Defaults to every one. */
  templates?: readonly string[]
  /**
   * Whether a file is in the package a template comes from, such as a gallery image. Without it, a gallery image
   * that's a path is only checked to stay inside the package.
   */
  files?: (path: string, template: string) => boolean
}

/**
 * Catalog CI: checks references, questions, required add-on options, facets and version pins. With `matrix`, it
 * also plans every pair of answers for each template and mode, or for the `templates` listed, and reports any that fail.
 */
export function checkCatalog(catalog: CatalogManifest, options: CheckOptions = {}): string[] {
  const problems: string[] = []

  if (!isValidVersion(catalog.version)) {
    problems.push(`Catalog version "${catalog.version}" isn't a semantic version.`)
  }

  for (const [kind, ids] of [
    ["add-on", catalog.addons.map((addon) => addon.id)],
    ["target", catalog.targets.map((target) => target.id)],
    ["template", catalog.templates.map((template) => template.id)],
    ["question", (catalog.questions ?? []).map((question) => question.id)],
    ["preset", (catalog.presets ?? []).map((preset) => preset.id)]
  ] as const) {
    for (const id of duplicates(ids)) {
      problems.push(`More than one ${kind} has the id ${id}.`)
    }
  }

  // A template argument that looks like a package is fetched from npm, so built-in ids can't look like one.
  for (const template of catalog.templates) {
    const pack = packOf(template.id)
    const own = pack === undefined ? template.id : template.id.slice(pack.length + 1)

    if ((pack !== undefined && !catalog.packs?.[pack]) || /[/#:]/.test(own) || own.startsWith("@")) {
      problems.push(`Template id ${template.id} can't contain /, # or :, or start with @.`)
    }
  }

  for (const target of catalog.targets) {
    if (target.modes.length === 0) {
      problems.push(`Target ${target.id} has no modes.`)
    }

    for (const mode of target.modes) {
      for (const facet of mode.facets) {
        if (!catalog.facets.includes(facet)) {
          problems.push(`Target ${target.id} mode ${mode.id} uses facet ${facet}, which isn't registered.`)
        }
      }
    }
  }

  const versions = catalog.versions ?? {}

  if (catalog.range !== undefined && !rangeStyles.includes(catalog.range)) {
    problems.push(`Catalog range "${String(catalog.range)}" isn't exact, caret or tilde.`)
  }

  for (const [name, pin] of Object.entries(versions)) {
    if (!isValidRange(pin)) {
      problems.push(`The pin for ${name}, "${pin}", isn't an exact version or a version range.`)
    }
  }

  problems.push(...packageProblems(catalog))
  const provides = new Set(catalog.addons.flatMap((addon) => Object.keys(addon.provides ?? {})))

  for (const addon of catalog.addons) {
    if (!isValidVersion(addon.version)) {
      problems.push(`${addon.id} version "${addon.version}" isn't a semantic version.`)
    }

    // The resolver reads `provides:` in requires, conflicts and joins. In after it would be accepted and do nothing.
    for (const [field, references] of [
      ["conflicts", addon.conflicts ?? []],
      ["after", addon.after ?? []]
    ] as const) {
      for (const reference of references) {
        if (reference.startsWith("provides:") && field === "conflicts") {
          if (!provides.has(reference.slice(9))) {
            problems.push(`${addon.id} refers to ${reference}, and no add-on provides it.`)
          }
        } else if (reference.startsWith("provides:")) {
          problems.push(`${addon.id} uses ${reference} in after, which takes add-on ids only.`)
        } else if (!findAddon(catalog, reference)) {
          problems.push(`${addon.id} refers to ${reference}, which isn't in the catalog.`)
        }
      }
    }

    for (const reference of addon.requires ?? []) {
      if (reference.startsWith("provides:")) {
        if (!provides.has(reference.slice(9))) {
          problems.push(`${addon.id} refers to ${reference}, and no add-on provides it.`)
        }
      } else if (!findAddon(catalog, reference)) {
        problems.push(`${addon.id} refers to ${reference}, which isn't in the catalog.`)
      }
    }

    if (addon.joins) {
      if (addon.joins.length < 2) {
        problems.push(`${addon.id} is a combination add-on, so it joins at least two add-ons.`)
      }

      if ((addon.requires ?? []).length > 0 || addon.options) {
        problems.push(`${addon.id} is a combination add-on, so it can't have requires or options.`)
      }

      for (const reference of addon.joins) {
        if (reference.startsWith("provides:")) {
          if (!provides.has(reference.slice(9))) {
            problems.push(`${addon.id} refers to ${reference}, and no add-on provides it.`)
          }
        } else if (!findAddon(catalog, reference)) {
          problems.push(`${addon.id} refers to ${reference}, which isn't in the catalog.`)
        }
      }
    }

    for (const [name, range] of Object.entries(addon.packages ?? {})) {
      const pin = versions[name]

      if (!isValidRange(range)) {
        problems.push(`${addon.id} is written for ${name} "${range}", which isn't a version range.`)
      } else if (pin === undefined) {
        problems.push(`${addon.id} is written for ${name}, which the catalog doesn't pin.`)
      } else if (isValidRange(pin)) {
        const lowest = lowestVersion(pin)

        if (lowest === undefined) {
          problems.push(`${addon.id} is written for ${name} ${range}, but the pin "${pin}" allows no version.`)
        } else if (!satisfiesRange(lowest, range)) {
          problems.push(`${addon.id} is written for ${name} ${range}, but the pin "${pin}" allows ${lowest}.`)
        }
      }
    }

    const schema = optionsSchema(addon)
    const properties = isRecord(schema.properties) ? schema.properties : {}

    for (const key of addon.ask ?? []) {
      if (!Object.hasOwn(properties, key)) {
        problems.push(`${addon.id} asks about option ${key}, which it doesn't define.`)
      }
    }

    for (const migration of addon.migrations ?? []) {
      if (!isValidVersion(migration.version)) {
        problems.push(
          `${addon.id} has a migration with version "${migration.version}", which isn't a semantic version.`
        )
      } else if (isValidVersion(addon.version) && compareVersions(migration.version, addon.version) > 0) {
        problems.push(`${addon.id} has a migration for ${migration.version}, which is newer than the add-on.`)
      }
    }
  }

  for (const template of catalog.templates) {
    let expanded: ExpandedTemplate | undefined

    try {
      expanded = expandTemplate(catalog, template.id)
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error))
      continue
    }

    if (!expanded) {
      continue
    }

    problems.push(...templateProblems(catalog, template, expanded, options.files))
    const target = findTarget(catalog, expanded.target)

    if (!target) {
      problems.push(`Template ${template.id} uses target ${expanded.target}, which isn't in the catalog.`)
      continue
    }

    for (const modeId of expanded.modes) {
      const mode = findMode(target, modeId)

      if (!mode) {
        problems.push(`Template ${template.id} offers mode ${modeId}, which ${target.id} doesn't have.`)
        continue
      }

      const info = targetInfo(catalog, target, mode)

      const check = (id: string, role: string) => {
        const addon = findAddon(catalog, id)

        if (!addon) {
          problems.push(`Template ${template.id} names ${role} add-on ${id}, which isn't in the catalog.`)

          return
        }

        const support = addonSupports(addon, info)

        if (support !== true) {
          problems.push(
            `Template ${template.id} names ${id}, which doesn't support ${target.id}/${mode.id}: ${support}`
          )
        }
      }

      for (const id of expanded.required) {
        check(id, "required")
        const addon = findAddon(catalog, id)

        if (addon && !parseOptions(addon, {}).ok) {
          problems.push(`${id} is required by template ${template.id}, so every option needs a default.`)
        }
      }

      for (const question of expanded.questions) {
        for (const id of question.default) {
          check(id, "default")
        }
      }
    }
  }

  // A combination add-on is added with what it joins, so nothing names it.
  const combination = (id: string) => findAddon(catalog, id)?.joins !== undefined

  for (const preset of catalog.presets ?? []) {
    const named = [...Object.values(preset.answers.questions ?? {}).flat(), ...(preset.answers.extra ?? [])]

    for (const id of named.filter(combination)) {
      problems.push(`Preset ${preset.id} names ${id}, a combination add-on, which is added with what it joins.`)
    }

    if (!findTemplate(catalog, preset.answers.template)) {
      problems.push(`Preset ${preset.id} uses template ${preset.answers.template}, which isn't in the catalog.`)
      continue
    }

    problems.push(...planAnswers(catalog, { ...preset.answers, name: "catalog-check" }, `Preset ${preset.id}`))
  }

  if (options.matrix && problems.length === 0) {
    for (const template of catalog.templates.filter(
      (candidate) => options.templates === undefined || options.templates.includes(candidate.id)
    )) {
      for (const mode of expandTemplate(catalog, template.id)?.modes ?? []) {
        for (const answers of pairwiseAnswers(catalog, template.id, mode)) {
          problems.push(
            ...planAnswers(
              catalog,
              answers,
              `Template ${template.id} (${JSON.stringify({ mode, questions: answers.questions })})`
            )
          )
        }
      }
    }
  }

  return [...new Set(problems)]
}

/** The CLI's own flags, which a question id can't be, since the id is a flag too. */
export const cliFlags: ReadonlySet<string> = new Set([
  "adopt",
  "catalog-version",
  "conflict",
  "cwd",
  "diff",
  "dry-run",
  "json",
  "list",
  "mode",
  "name",
  "out",
  "plan",
  "preset",
  "replace",
  "resolve",
  "set",
  "setup",
  "with",
  "without",
  "yes"
])

/** Lowercase letters, digits and hyphens: a question id, which is also a flag, or a gallery tag. */
export const questionIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Problems with a template's questions, its parent and its gallery, found on the template as it's expanded. */
function templateProblems(
  catalog: CatalogManifest,
  template: TemplateManifest,
  expanded: ExpandedTemplate,
  files: CheckOptions["files"]
): string[] {
  const problems: string[] = []
  const label = `Template ${template.id}`
  const combination = (id: string) => findAddon(catalog, id)?.joins !== undefined

  for (const id of expanded.required.filter(combination)) {
    problems.push(`${label} names ${id}, a combination add-on, which is added with what it joins.`)
  }

  for (const entry of template.questions ?? []) {
    if (isString(entry)) {
      continue
    }

    if ("use" in entry) {
      const pick = expanded.questions.find((question) => question.id === entry.use)?.pick

      if (entry.default !== undefined && Array.isArray(entry.default) !== (pick === "many")) {
        problems.push(`${label} gives question ${entry.use} a default that doesn't match its pick, ${pick ?? "one"}.`)
      }
    } else if (findQuestion(catalog, entry.id)) {
      problems.push(`${label} defines question ${entry.id}, which is a catalog question's id. Use it with use instead.`)
    }
  }

  if (template.extends !== undefined && template.omit) {
    const parent = expandTemplate(catalog, template.extends)

    for (const id of template.omit) {
      if (!parent?.questions.some((question) => question.id === id) && !parent?.required.includes(id)) {
        problems.push(`${label} omits ${id}, which ${template.extends} doesn't have.`)
      }
    }
  }

  const offeredBy = new Map<string, string>()
  const before = [...expanded.required]

  for (const question of expanded.questions) {
    const named = `${label} question ${question.id}`

    if (!questionIdPattern.test(question.id)) {
      problems.push(`${named} needs an id of lowercase letters, digits and hyphens.`)
    } else if (cliFlags.has(question.id)) {
      problems.push(`${named} has the id of one of the CLI's own flags.`)
    }

    if (!question.required && question.question === undefined) {
      problems.push(`${named} is optional, so it needs a question, such as "Add a database?".`)
    }

    if (question.choices.length === 0) {
      problems.push(`${named} has no choices.`)
    } else if (question.choices.length > 1 && question.choose === undefined) {
      problems.push(`${named} offers several choices, so it needs choose, such as "Which one?".`)
    }

    const offered = question.choices.map((choice) => choice.id)

    for (const id of offered) {
      if (!findAddon(catalog, id)) {
        problems.push(`${named} offers ${id}, which isn't in the catalog.`)
      } else if (combination(id)) {
        problems.push(`${named} offers ${id}, a combination add-on, which is added with what it joins.`)
      }

      const other = offeredBy.get(id)

      if (other !== undefined && other !== question.id) {
        problems.push(`${label} offers ${id} in two questions, ${other} and ${question.id}.`)
      }

      offeredBy.set(id, question.id)
    }

    for (const id of question.default.filter((entry) => !offered.includes(entry))) {
      problems.push(`${named} defaults to ${id}, which it doesn't offer.`)
    }

    if (question.pick === "one" && question.default.length > 1) {
      problems.push(`${named} picks one, so its default is one add-on.`)
    }

    if (question.pick === "many") {
      const addons = offered.map((id) => findAddon(catalog, id)).filter((addon) => addon !== undefined)

      for (const [index, addon] of addons.entries()) {
        for (const other of addons.slice(index + 1)) {
          if (addonsConflict(addon, other)) {
            problems.push(`${named} picks many, and offers ${addon.id} and ${other.id}, which conflict.`)
          }
        }
      }
    }

    // A choice that needs a capability only a later question provides can't be picked when it's asked.
    const earlier = pulledIn(catalog, before)

    const later = expanded.questions.slice(expanded.questions.indexOf(question) + 1).flatMap((next) =>
      pulledIn(
        catalog,
        next.choices.map((choice) => choice.id)
      )
    )

    for (const id of offered) {
      const own = pulledIn(catalog, [id])

      for (const requirement of own.flatMap((addon) => addon.requires ?? [])) {
        if (
          requirement.startsWith("provides:") &&
          !referenceMatches(requirement, [...earlier, ...own]) &&
          referenceMatches(requirement, later)
        ) {
          problems.push(
            `${named} offers ${id}, which needs ${requirement}, and only a later question provides it. Ask that one first.`
          )
        }
      }
    }

    before.push(...offered)
  }

  const gallery = template.gallery

  for (const tag of gallery?.tags ?? []) {
    if (!questionIdPattern.test(tag)) {
      problems.push(`${label} has the gallery tag "${tag}", which isn't lowercase and hyphenated.`)
    }
  }

  for (const [name, url] of Object.entries(gallery?.links ?? {})) {
    if (url !== undefined && !isHttps(url)) {
      problems.push(`${label} has the ${name} link "${url}", which isn't an https URL.`)
    }
  }

  const image = gallery?.image

  if (image !== undefined && !isHttps(image)) {
    const problem = imageProblem(image, (path) => files?.(path, template.id) ?? true)

    if (problem) {
      problems.push(`${label} has the gallery image "${image}", which ${problem}.`)
    }
  }

  return problems
}

/** Why a gallery image that isn't an https URL can't be used: it's another kind of URL, leaves the package, or is missing. */
function imageProblem(image: string, exists: (path: string) => boolean): string | undefined {
  if (URL.canParse(image)) {
    return "isn't an https URL or a path in the package"
  }

  const parts = image.split(/[\\/]/)

  if (image.startsWith("/") || /^[a-z]:/i.test(image) || parts.includes("..")) {
    return "isn't a path inside the package"
  }

  return exists(image) ? undefined : "isn't in the package"
}

/** Bare add-ons need a pin, and every place that names one has to agree on its details. */
function packageProblems(catalog: CatalogManifest): string[] {
  const problems: string[] = []
  const versions = catalog.versions ?? {}
  const details = new Map<string, string>()

  for (const ref of packageRefs(catalog)) {
    const name = isString(ref) ? ref.slice(4) : ref.npm

    if (versions[name] === undefined) {
      problems.push(`npm:${name} is a bare add-on, so the catalog needs a pin for ${name}.`)
    }

    if (!isString(ref)) {
      const seen = JSON.stringify([ref.title, ref.description, ref.dev === true])

      if (details.has(name) && details.get(name) !== seen) {
        problems.push(`npm:${name} is given different titles, descriptions or dev flags.`)
      }

      details.set(name, seen)
    }
  }

  return problems
}

function isHttps(url: string): boolean {
  return URL.canParse(url) && new URL(url).protocol === "https:"
}

function planAnswers(catalog: CatalogManifest, answers: Answers, label: string): string[] {
  try {
    const selection = selectionFromAnswers(catalog, answers, answers.name ?? "catalog-check")

    if (!selection.ok) {
      return []
    }

    const resolved = resolveSelection(catalog, selection.selection)

    if (!resolved.ok) {
      return []
    }

    const rendered = render(catalog, resolved.value, defineSettings({ product: "catalog-check" }))

    return rendered.envVars
      .filter((variable) => variable.help !== undefined && !isHttps(variable.help))
      .map((variable) => `${variable.name} has the help link "${variable.help}", which isn't an https URL.`)
  } catch (error) {
    return [
      `${label} fails to plan: ${error instanceof PlanError || error instanceof Error ? error.message : String(error)}`
    ]
  }
}

/**
 * Answer sets that cover every pair of values across a template's questions, for catalog CI's matrix. A `one` question
 * is one factor, its choices plus no when it's optional. A `many` question is one in-or-out factor per choice, and a
 * row that leaves a required one empty gets its first choice.
 */
export function pairwiseAnswers(catalog: CatalogManifest, templateId: string, mode: string): Answers[] {
  const template = expandTemplate(catalog, templateId)

  if (!template) {
    return []
  }

  const target = findTarget(catalog, template.target)
  const found = target ? findMode(target, mode) : undefined
  const info = target && found ? targetInfo(catalog, target, found) : undefined

  type Factor = { apply: (answers: Answers, value: number) => Answers; values: number }

  const factors: Factor[] = []
  const many: { id: string; required: boolean; first: string | undefined }[] = []

  const answer = (answers: Answers, question: string, ids: string[]): Answers => ({
    ...answers,
    questions: { ...answers.questions, [question]: ids }
  })

  for (const question of template.questions) {
    const candidates = question.choices
      .map((choice) => findAddon(catalog, choice.id))
      .filter((addon) => addon !== undefined && (!info || addonSupports(addon, info) === true))
      .map((addon) => addon?.id ?? "")

    if (question.pick === "one") {
      const values: (string | undefined)[] = [...(question.required ? [] : [undefined]), ...candidates]
      factors.push({
        // A required question with no add-on for the mode still gets one value, unanswered, so the other questions
        // are planned and the plan reports the question.
        values: Math.max(values.length, 1),
        apply: (answers, value) => {
          const id = values[value]

          if (id === undefined && question.required) {
            return answers
          }

          return answer(answers, question.id, id === undefined ? [] : [id])
        }
      })
      continue
    }

    many.push({ id: question.id, required: question.required, first: candidates[0] })

    for (const id of candidates) {
      factors.push({
        values: 2,
        apply: (answers, value) => {
          const current = (answers.questions?.[question.id] ?? []).filter((entry) => entry !== id)

          return answer(answers, question.id, value === 1 ? [...current, id] : current)
        }
      })
    }
  }

  const base: Answers = { template: templateId, mode, name: "catalog-check" }

  const filled = (answers: Answers): Answers =>
    many.reduce((current, question) => {
      const ids = current.questions?.[question.id] ?? []

      if (ids.length > 0) {
        return current
      }

      if (question.required) {
        return question.first === undefined ? current : answer(current, question.id, [question.first])
      }

      return answer(current, question.id, [])
    }, answers)

  if (factors.length < 2) {
    const [only] = factors

    return only ? Array.from({ length: only.values }, (_, value) => filled(only.apply(base, value))) : [filled(base)]
  }

  const sizes = factors.map((factor) => factor.values)

  const answersOf = (row: number[]) =>
    filled(row.reduce((answers, value, index) => factors[index]?.apply(answers, value) ?? answers, base))

  // A row the engine turns down, such as one with two add-ons that conflict, plans nothing. Its pairs that no other row
  // has each get a row of their own, with the other questions at their first value, unless that's turned down too.
  const rows = coveringRows(sizes).filter((row) => !turnedDown(catalog, answersOf(row)))
  const covered = new Set(rows.flatMap(rowPairs))

  for (let left = 0; left < sizes.length; left++) {
    for (let right = left + 1; right < sizes.length; right++) {
      for (let a = 0; a < (sizes[left] ?? 0); a++) {
        for (let b = 0; b < (sizes[right] ?? 0); b++) {
          if (covered.has(pairKey(left, a, right, b))) {
            continue
          }

          const row = sizes.map(() => 0)
          row[left] = a
          row[right] = b

          if (!turnedDown(catalog, answersOf(row))) {
            rows.push(row)
            rowPairs(row).forEach((pair) => covered.add(pair))
          }
        }
      }
    }
  }

  return rows.map(answersOf)
}

/**
 * Whether the engine turns the answers down without an error, as it does two add-ons that conflict. An error is a
 * catalog problem, so answers that throw aren't turned down: the matrix check plans them to report it.
 */
function turnedDown(catalog: CatalogManifest, answers: Answers): boolean {
  try {
    const selection = selectionFromAnswers(catalog, answers, answers.name ?? "catalog-check")

    return !selection.ok || !resolveSelection(catalog, selection.selection).ok
  } catch {
    return false
  }
}

function pairKey(left: number, a: number, right: number, b: number): string {
  return `${left}:${a}:${right}:${b}`
}

/** The pairs of values a row covers. */
function rowPairs(row: readonly number[]): string[] {
  return row.flatMap((a, left) => row.slice(left + 1).map((b, offset) => pairKey(left, a, left + 1 + offset, b)))
}

/**
 * Rows of values, one per factor, in which every pair of values of every two factors appears at least once: a greedy
 * covering array. Each row starts from the first pair no row has covered, then gives every other factor the value that
 * covers the most pairs still missing, the lowest value on a tie, so the result is the same every time.
 */
function coveringRows(sizes: readonly number[]): number[][] {
  const missing = new Set<string>()

  for (let left = 0; left < sizes.length; left++) {
    for (let right = left + 1; right < sizes.length; right++) {
      for (let a = 0; a < (sizes[left] ?? 0); a++) {
        for (let b = 0; b < (sizes[right] ?? 0); b++) {
          missing.add(pairKey(left, a, right, b))
        }
      }
    }
  }

  const rows: number[][] = []

  while (missing.size > 0) {
    const [first = ""] = missing
    const [left = 0, a = 0, right = 0, b = 0] = first.split(":").map(Number)
    const row: (number | undefined)[] = sizes.map(() => undefined)
    row[left] = a
    row[right] = b

    for (let factor = 0; factor < sizes.length; factor++) {
      if (row[factor] !== undefined) {
        continue
      }

      let best = 0
      let bestGain = -1

      for (let value = 0; value < (sizes[factor] ?? 0); value++) {
        let gain = 0
        row.forEach((other, index) => {
          if (other !== undefined && index !== factor) {
            const pair = index < factor ? pairKey(index, other, factor, value) : pairKey(factor, value, index, other)
            gain += missing.has(pair) ? 1 : 0
          }
        })

        if (gain > bestGain) {
          best = value
          bestGain = gain
        }
      }

      row[factor] = best
    }

    const values = row.map((value) => value ?? 0)

    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        missing.delete(pairKey(i, values[i] ?? 0, j, values[j] ?? 0))
      }
    }

    rows.push(values)
  }

  return rows
}
