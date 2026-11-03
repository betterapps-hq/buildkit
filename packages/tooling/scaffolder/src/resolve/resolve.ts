import {
  findAddon,
  findMode,
  findTarget,
  findTemplate,
  lookupAddon,
  parseOptions,
  targetInfo
} from "../manifest/catalog.js"
import type {
  AddonManifest,
  CatalogManifest,
  ResolveContext,
  TargetInfo,
  TargetManifest,
  TargetMode,
  TemplateManifest
} from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"

/** The project's choices: what the config holds, and what the lock records as applied. */
export interface Selection {
  name: string
  template: string
  target: { id: string; mode: string }
  /** Explicitly chosen add-ons and their raw options. */
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- raw options keyed by add-on id, which each add-on's schema parses
  addons: Record<string, Record<string, unknown>>
  declined: string[]
}

export interface ResolvedAddon {
  manifest: AddonManifest
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- options the add-on's own schema parsed, so only it knows their types
  options: Record<string, unknown>
  explicit: boolean
  /** Add-ons that pulled this one in through `requires`, or that a combination add-on joins. */
  by: string[]
}

export interface ResolvedSelection {
  name: string
  template: TemplateManifest
  target: TargetManifest
  mode: TargetMode
  info: TargetInfo
  /** In contribution order: each add-on after everything it requires, joins or runs after. */
  addons: ResolvedAddon[]
  declined: string[]
}

/** Something only the user can answer. The planner turns each issue into a decision with complete requests. */
export type ResolveIssue =
  | { kind: "choose-mode"; template: string; modes: string[] }
  /** A required question with no default and more than one available choice, or `add <question>`. */
  | { kind: "choose"; template: string; question: string; candidates: string[] }
  | { kind: "choose-provider"; capability: string; by: string; candidates: string[] }
  /** `addon` declares the conflict. With `capability`, it conflicts with any add-on that provides it, as `other` does. */
  | { kind: "conflicts"; addon: string; other: string; capability?: string }

export type ResolveResult = { ok: true; value: ResolvedSelection } | { ok: false; issue: ResolveIssue }

const projectNamePattern = /^(?:@[a-z0-9][a-z0-9-._~]*\/)?[a-z0-9][a-z0-9-._~]*$/

/** npm-safe names only: no path separators, spaces, uppercase or leading dots. */
export function projectNameProblem(name: string): string | undefined {
  if (name.length === 0 || name.length > 214) {
    return "Use 1 to 214 characters."
  }

  if (!projectNamePattern.test(name)) {
    return "Use lowercase letters, digits, hyphens, dots and underscores, starting with a letter or digit."
  }

  if (name === "node_modules" || name === "favicon.ico") {
    return `"${name}" is reserved.`
  }

  return undefined
}

export function unknownAddonError(catalog: CatalogManifest, name: string): PlanError {
  const lookup = lookupAddon(catalog, name)
  const suggestions = "suggestions" in lookup ? lookup.suggestions : []
  const ambiguous = "ambiguous" in lookup && lookup.ambiguous
  const hint = suggestions.length > 0 ? ` ${ambiguous ? "It could be" : "Did you mean"} ${suggestions.join(", ")}?` : ""

  return new PlanError(
    "E_UNKNOWN_ADDON",
    `${ambiguous ? `"${name}" matches more than one add-on.` : `There's no add-on named "${name}".`}${hint}`,
    {
      next: suggestions
    }
  )
}

/**
 * Throws `E_USAGE` for a combination add-on, which is never asked for by name: "Better Auth tables for Drizzle is added
 * with Better Auth and Drizzle."
 */
export function refuseCombination(catalog: CatalogManifest, id: string): void {
  const addon = findAddon(catalog, id)

  if (!addon?.joins) {
    return
  }

  const parts = addon.joins.map((reference) =>
    reference.startsWith("provides:")
      ? `an add-on that provides ${reference.slice(9)}`
      : (findAddon(catalog, reference)?.title ?? reference)
  )

  const last = parts.pop() ?? ""
  throw new PlanError(
    "E_USAGE",
    `${addon.title} is added with ${parts.length > 0 ? `${parts.join(", ")} and ${last}` : last}.`
  )
}

/** Resolves a name to an add-on id, or throws `E_UNKNOWN_ADDON` with suggestions. */
export function requireAddonId(catalog: CatalogManifest, name: string): string {
  const lookup = lookupAddon(catalog, name)

  if ("id" in lookup) {
    return lookup.id
  }

  throw unknownAddonError(catalog, name)
}

export function resolveTarget(catalog: CatalogManifest, selection: Pick<Selection, "template" | "target">) {
  const template = findTemplate(catalog, selection.template)

  if (!template) {
    throw new PlanError("E_UNKNOWN_TEMPLATE", `There's no template named "${selection.template}".`, {
      next: catalog.templates.map((candidate) => candidate.id)
    })
  }

  const target = findTarget(catalog, selection.target.id)

  if (!target) {
    throw new PlanError("E_UNKNOWN_TARGET", `There's no target named "${selection.target.id}".`)
  }

  const mode = findMode(target, selection.target.mode)

  if (!mode) {
    throw new PlanError(
      "E_UNKNOWN_TARGET",
      `${target.title} has no mode "${selection.target.mode}". Use ${target.modes.map((candidate) => candidate.id).join(" or ")}.`
    )
  }

  return { template, target, mode, info: targetInfo(catalog, target, mode) }
}

/** Calls `supports()` with the add-on's default options. Used to filter the choices a question offers. */
export function addonSupports(
  addon: AddonManifest,
  info: TargetInfo,
  options?: Selection["addons"][string]
): true | string {
  if (!addon.supports) {
    return true
  }

  const parsed = parseOptions(addon, options)

  if (!parsed.ok) {
    return true
  }

  return addon.supports({ options: parsed.value, target: info, provided: () => undefined, selected: () => false })
}

/**
 * Resolves a selection: pulls in `requires`, adds the combination add-ons whose references all match, checks
 * capabilities and conflicts, orders add-ons, and validates options and support.
 */
export function resolveSelection(catalog: CatalogManifest, selection: Selection): ResolveResult {
  const nameProblem = projectNameProblem(selection.name)

  if (nameProblem) {
    throw new PlanError("E_INVALID_OPTIONS", `"${selection.name}" can't be a project name. ${nameProblem}`)
  }

  const { template, target, mode, info } = resolveTarget(catalog, selection)
  const chosen = new Map<string, { explicit: boolean; by: Set<string> }>()

  const visit = (id: string, by: string | undefined) => {
    const addon = findAddon(catalog, id)

    if (!addon) {
      throw unknownAddonError(catalog, id)
    }

    // A combination add-on is selected by what it joins, never by name.
    if (addon.joins) {
      return
    }

    const existing = chosen.get(id)

    if (existing) {
      if (by) {
        existing.by.add(by)
      } else {
        existing.explicit = true
      }

      return
    }

    chosen.set(id, { explicit: by === undefined, by: new Set(by ? [by] : []) })

    for (const requirement of addon.requires ?? []) {
      if (!requirement.startsWith("provides:")) {
        visit(requirement, id)
      }
    }
  }

  for (const id of Object.keys(selection.addons).sort()) {
    visit(id, undefined)
  }

  const selected = [...chosen.keys()].flatMap((id) => findAddon(catalog, id) ?? [])

  // Combination add-ons join when every reference matches, and one can join another, so this runs until nothing changes.
  // They're part of the selection before its requirements and conflicts are checked.
  for (let added = true; added;) {
    added = false

    for (const addon of catalog.addons) {
      const joined = addon.joins && !chosen.has(addon.id) ? joinedBy(addon.joins, selected) : undefined

      if (joined) {
        chosen.set(addon.id, { explicit: false, by: new Set(joined) })
        selected.push(addon)
        added = true
      }
    }
  }

  for (const addon of selected) {
    for (const requirement of addon.requires ?? []) {
      if (requirement.startsWith("provides:")) {
        const capability = requirement.slice(9)

        if (!selected.some((other) => other.provides && Object.hasOwn(other.provides, capability))) {
          const candidates = catalog.addons
            // A combination is never added by name, so it's never a choice.
            .filter(
              (candidate) => !candidate.joins && candidate.provides && Object.hasOwn(candidate.provides, capability)
            )
            .filter((candidate) => addonSupports(candidate, info) === true)
            .map((candidate) => candidate.id)

          return { ok: false, issue: { kind: "choose-provider", capability, by: addon.id, candidates } }
        }
      }
    }
  }

  for (const addon of selected) {
    for (const other of selected) {
      const conflict = declaredConflict(addon, other)

      if (conflict) {
        return { ok: false, issue: { kind: "conflicts", addon: addon.id, other: other.id, ...conflict } }
      }
    }
  }

  const ordered = orderAddons(selected)

  const provided: ResolveContext<unknown>["provided"] = (name) =>
    ordered.find((addon) => addon.provides && Object.hasOwn(addon.provides, name))?.provides?.[name]

  const isSelected = (id: string) => chosen.has(id)
  const addons: ResolvedAddon[] = []

  for (const addon of ordered) {
    const parsed = parseOptions(addon, selection.addons[addon.id])

    if (!parsed.ok) {
      throw new PlanError("E_INVALID_OPTIONS", `${addon.title} has invalid options: ${parsed.issues.join("; ")}.`)
    }

    const support = addon.supports?.({ options: parsed.value, target: info, provided, selected: isSelected }) ?? true

    if (support !== true) {
      throw new PlanError("E_UNSUPPORTED", `${addon.title} doesn't support ${target.title} (${mode.title}): ${support}`)
    }

    const state = chosen.get(addon.id)
    addons.push({
      manifest: addon,
      options: parsed.value,
      explicit: state?.explicit ?? false,
      by: [...(state?.by ?? [])].sort()
    })
  }

  return {
    ok: true,
    value: { name: selection.name, template, target, mode, info, addons, declined: [...selection.declined].sort() }
  }
}

/** The add-ons that match every reference of a combination add-on, or `undefined` when one doesn't match. */
function joinedBy(references: readonly string[], selected: readonly AddonManifest[]): string[] | undefined {
  const joined = new Set<string>()

  for (const reference of references) {
    const matches = selected.filter((addon) =>
      reference.startsWith("provides:")
        ? addon.provides !== undefined && Object.hasOwn(addon.provides, reference.slice(9))
        : addon.id === reference
    )

    if (matches.length === 0) {
      return undefined
    }

    matches.forEach((addon) => joined.add(addon.id))
  }

  return [...joined]
}

/**
 * Whether `addon` declares a conflict with `other`: by its id, or by `provides:<name>` when `other` provides it. An
 * add-on never conflicts with itself, so an ORM that conflicts with `provides:orm` can still be installed.
 */
function declaredConflict(addon: AddonManifest, other: AddonManifest): { capability?: string } | undefined {
  if (addon.id === other.id) {
    return undefined
  }

  for (const reference of addon.conflicts ?? []) {
    if (reference.startsWith("provides:")) {
      const capability = reference.slice(9)

      if (other.provides && Object.hasOwn(other.provides, capability)) {
        return { capability }
      }
    } else if (reference === other.id) {
      return {}
    }
  }

  return undefined
}

/** Whether two add-ons can't be installed together. One side declaring it is enough. */
export function addonsConflict(left: AddonManifest, right: AddonManifest): boolean {
  return declaredConflict(left, right) !== undefined || declaredConflict(right, left) !== undefined
}

/** Orders add-ons so each comes after what it requires, joins or runs after. Ties sort by id; a cycle is an error. */
function orderAddons(addons: AddonManifest[]): AddonManifest[] {
  const ids = new Set(addons.map((addon) => addon.id))
  const edges = new Map<string, Set<string>>()

  for (const addon of addons) {
    const before = new Set<string>()

    for (const requirement of [...(addon.requires ?? []), ...(addon.joins ?? [])]) {
      if (requirement.startsWith("provides:")) {
        const capability = requirement.slice(9)
        addons
          .filter((other) => other.provides && Object.hasOwn(other.provides, capability))
          .forEach((other) => before.add(other.id))
      } else {
        before.add(requirement)
      }
    }

    for (const after of addon.after ?? []) {
      if (ids.has(after)) {
        before.add(after)
      }
    }

    before.delete(addon.id)
    edges.set(addon.id, before)
  }

  const result: AddonManifest[] = []
  const done = new Set<string>()
  const pending = addons.map((addon) => addon.id).sort()

  while (pending.length > 0) {
    const index = pending.findIndex((id) => [...(edges.get(id) ?? [])].every((dependency) => done.has(dependency)))
    const next = index === -1 ? undefined : pending[index]

    if (next === undefined) {
      throw new PlanError("E_CYCLE", `These add-ons require each other in a cycle: ${pending.join(", ")}.`)
    }

    pending.splice(index, 1)
    done.add(next)
    const addon = addons.find((candidate) => candidate.id === next)

    if (addon) {
      result.push(addon)
    }
  }

  return result
}
