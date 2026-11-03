import { expandTemplate, findAddon, findTarget, lookupAddon } from "../manifest/catalog.js"
import type { CatalogManifest } from "../manifest/types.js"
import { selectionFromAnswers } from "../resolve/answers.js"
import { pulledIn, questionChoices } from "../resolve/questions.js"
import {
  addonsConflict,
  refuseCombination,
  requireAddonId,
  resolveTarget,
  type ResolveIssue,
  type Selection
} from "../resolve/resolve.js"
import type { Lock, ProjectConfig } from "../state/schemas.js"
import { PlanError } from "./errors.js"
import type { Intent } from "./types.js"

export type DesiredResult =
  | { ok: true; selection: Selection; required: string[]; adopt: boolean; unchanged: string[] }
  | { ok: false; issue: ResolveIssue }

export function selectionFromConfig(config: ProjectConfig): Selection {
  return {
    name: config.name,
    template: config.template,
    target: { id: config.target.id, mode: config.target.mode },
    addons: structuredClone(config.addons),
    declined: [...(config.declined ?? [])]
  }
}

export function selectionFromLock(lock: Lock): Selection {
  const addons: Record<string, Record<string, unknown>> = {}
  for (const [id, state] of Object.entries(lock.addons)) {
    if (state.explicit) {
      addons[id] = structuredClone(state.options)
    }
  }
  return {
    name: lock.project.name,
    template: lock.project.template,
    target: { ...lock.project.target },
    addons,
    declined: [...lock.project.declined]
  }
}

function requireConfig(config: ProjectConfig | undefined, command: string): ProjectConfig {
  if (!config) {
    throw new PlanError(
      "E_NOT_INITIALIZED",
      `This folder isn't a project yet, so ${command} has nothing to change. Run create first.`
    )
  }
  return config
}

/** The selection a command asks for, built from the current config. */
export function desiredSelection(
  catalog: CatalogManifest,
  intent: Intent,
  config: ProjectConfig | undefined,
  lock: Lock | undefined
): DesiredResult {
  switch (intent.command) {
    case "init": {
      if (config) {
        throw new PlanError(
          "E_ALREADY_INITIALIZED",
          "This folder is already a project. Use add, config or upgrade to change it."
        )
      }
      const name = intent.answers.name
      if (name === undefined) {
        throw new PlanError("E_USAGE", "create needs a project name.")
      }
      const result = selectionFromAnswers(catalog, intent.answers, name)
      if (!result.ok) {
        return result
      }
      const required = expandTemplate(catalog, intent.answers.template)?.required ?? []
      return { ok: true, selection: result.selection, required, adopt: intent.answers.adopt === true, unchanged: [] }
    }
    case "add":
      return addSelection(catalog, intent, requireConfig(config, "add"), lock)
    case "config": {
      const current = requireConfig(config, "config")
      const selection = selectionFromConfig(current)
      for (const [name, options] of Object.entries(intent.options)) {
        const id = requireAddonId(catalog, name)
        const installed = Object.hasOwn(selection.addons, id) || lock?.addons[id] !== undefined
        if (!installed) {
          throw new PlanError("E_USAGE", `${id} isn't installed, so its options can't be set. Add it first.`)
        }
        selection.addons[id] = { ...selection.addons[id], ...options }
      }
      addAlong(catalog, selection, intent.addons)
      return { ok: true, selection, required: [], adopt: false, unchanged: [] }
    }
    case "upgrade":
    case "sync": {
      const selection = selectionFromConfig(requireConfig(config, intent.command))
      addAlong(catalog, selection, intent.addons)
      return { ok: true, selection, required: [], adopt: false, unchanged: [] }
    }
  }
}

/** Adds the add-ons a config, upgrade or sync request carries, keeping options for any already selected. */
function addAlong(catalog: CatalogManifest, selection: Selection, names: readonly string[] | undefined) {
  for (const name of names ?? []) {
    const id = requireAddonId(catalog, name)
    refuseCombination(catalog, id)
    selection.addons[id] ??= {}
  }
}

function addSelection(
  catalog: CatalogManifest,
  intent: Extract<Intent, { command: "add" }>,
  config: ProjectConfig,
  lock: Lock | undefined
): DesiredResult {
  const selection = selectionFromConfig(config)
  const { info } = resolveTarget(catalog, selection)
  const installed = (id: string) => Object.hasOwn(selection.addons, id) || lock?.addons[id] !== undefined
  const replaced: string[] = []
  for (const name of intent.replace) {
    if (findTarget(catalog, name) || name === config.target.id) {
      throw new PlanError("E_USAGE", "The target can't be replaced. Start a new project with create instead.")
    }
    const id = requireAddonId(catalog, name)
    if (!Object.hasOwn(selection.addons, id)) {
      throw new PlanError("E_USAGE", `${id} isn't installed, so it can't be replaced.`)
    }
    replaced.push(id)
  }
  const template = expandTemplate(catalog, config.template)
  const adding: string[] = []
  const unchanged: string[] = []
  for (const name of intent.addons) {
    // A name that isn't an add-on can be one of the template's questions: `add database`.
    const question =
      "id" in lookupAddon(catalog, name) ? undefined : template?.questions.find((candidate) => candidate.id === name)
    if (template && question) {
      const kept = Object.keys(selection.addons).filter((id) => !replaced.includes(id))
      const answered = question.choices.filter((choice) => installed(choice.id) && !replaced.includes(choice.id))
      const [occupant] = answered
      if (occupant && question.pick === "one") {
        unchanged.push(occupant.id)
        continue
      }
      const choices = questionChoices(catalog, template, question, info, pulledIn(catalog, kept)).filter(
        (choice) => !answered.some((other) => other.id === choice.id)
      )
      // The available choices come first. With none, every choice is offered, and the resolver turns what it needs or
      // conflicts with into the next decision, such as which database sign-in needs.
      const available = choices.filter((choice) => choice.disabled === undefined)
      const candidates = (available.length > 0 ? available : choices).map((choice) => choice.id)
      const [only] = candidates
      if (only === undefined) {
        throw new PlanError("E_UNSUPPORTED", `Nothing more can be added for ${question.title.toLowerCase()}.`)
      }
      if (candidates.length > 1) {
        return { ok: false, issue: { kind: "choose", template: template.id, question: question.id, candidates } }
      }
      adding.push(only)
      continue
    }
    const id = requireAddonId(catalog, name)
    refuseCombination(catalog, id)
    adding.push(id)
  }
  for (const id of replaced) {
    const outgoing = findAddon(catalog, id)
    const swaps = (other: string) => {
      const incoming = findAddon(catalog, other)
      return outgoing !== undefined && incoming !== undefined && addonsConflict(outgoing, incoming)
    }
    if (!adding.some(swaps)) {
      throw new PlanError(
        "E_USAGE",
        `--replace swaps add-ons that conflict, and nothing you're adding conflicts with ${id}.`
      )
    }
    delete selection.addons[id]
  }
  for (const id of adding) {
    if (Object.hasOwn(selection.addons, id) && !intent.options[id]) {
      unchanged.push(id)
      continue
    }
    selection.addons[id] = { ...selection.addons[id], ...intent.options[id] }
    // Adding an add-on answers the question that offers it, so neither it nor that question stays declined.
    const offeredBy = template?.questions.find((candidate) => candidate.choices.some((choice) => choice.id === id))
    selection.declined = selection.declined.filter(
      (entry) => entry !== id && entry !== `question:${offeredBy?.id ?? ""}`
    )
  }
  for (const [id, options] of Object.entries(intent.options)) {
    if (!adding.includes(id)) {
      if (!Object.hasOwn(selection.addons, id)) {
        throw new PlanError("E_USAGE", `Options were given for ${id}, but it isn't being added.`)
      }
      selection.addons[id] = { ...selection.addons[id], ...options }
    }
  }
  return { ok: true, selection, required: [], adopt: false, unchanged }
}
