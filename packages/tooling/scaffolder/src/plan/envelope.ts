import type { CatalogManifest } from "../manifest/types.js"
import { requestArgv } from "./argv.js"
import type { Plan, PlanErrorInfo, PlanRequest } from "./types.js"

export type EnvelopeStatus = "planned" | "applied" | "unchanged" | "needs-decision" | "conflict" | "error"

/** One bounded JSON object on stdout. Full contents go to plan artifacts, never here. */
export interface Envelope {
  status: EnvelopeStatus
  fingerprint?: string
  catalog?: { id: string; version: string }
  baseline?: Plan["baseline"]
  decisions?: {
    id: string
    message: string
    choices: { id: string; label: string; request: PlanRequest; argv: string[] }[]
  }[]
  conflicts?: { id: string; path: string; kind: string; message: string; resolutions: string[]; artifacts?: string }[]
  operations?: {
    path: string
    action: "create" | "update" | "delete"
    class: string
    linesAdded: number
    linesRemoved: number
    secret?: boolean
  }[]
  pulled?: Plan["pulled"]
  required?: string[]
  packages?: Plan["packages"]
  env?: Plan["env"]
  commands?: Plan["commands"]
  migrations?: Plan["migrations"]
  merged?: Plan["merged"]
  upgrade?: Plan["upgrade"]
  notices?: Plan["notices"]
  nextSteps?: string[]
  artifacts?: string
  /** The setup steps `create` ran after applying, and the one that failed. */
  setup?: SetupReport
  error?: PlanErrorInfo
}

export interface SetupReport {
  ran: string[]
  failed?: { label: string; run: string; output: string }
}

/** True when a plan list has entries, so the envelope includes it. */
function hasItems<T>(values: T[] | undefined): values is T[] {
  return values !== undefined && values.length > 0
}

export function toEnvelope(
  plan: Plan,
  options: {
    product: string
    status?: EnvelopeStatus
    artifacts?: string
    /** The installed catalog, so each choice's command writes `--without` for a declined default. */
    catalog?: CatalogManifest
    /** Earlier catalog versions, for a choice that plans with one. */
    catalogs?: (version: string) => CatalogManifest | undefined
  }
): Envelope {
  // A choice that plans with another catalog version is written against that version's defaults.
  const catalogFor = (request: PlanRequest) =>
    request.catalogVersion === undefined || request.catalogVersion === options.catalog?.version
      ? options.catalog
      : options.catalogs?.(request.catalogVersion)

  // Fields are added in the order the JSON prints them, and only when they have something to say.
  const envelope: Envelope = { status: options.status ?? plan.status }

  if (plan.fingerprint) {
    envelope.fingerprint = plan.fingerprint
  }

  envelope.catalog = plan.catalog

  if (plan.baseline) {
    envelope.baseline = plan.baseline
  }

  if (hasItems(plan.decisions)) {
    envelope.decisions = plan.decisions.map((decision) => ({
      id: decision.id,
      message: decision.message,
      choices: decision.choices.map((choice) => {
        const catalog = catalogFor(choice.request)

        return { ...choice, argv: [options.product, ...requestArgv(choice.request, catalog ? { catalog } : {})] }
      })
    }))
  }

  if (hasItems(plan.conflicts)) {
    envelope.conflicts = plan.conflicts.map((conflict) => {
      const entry: NonNullable<Envelope["conflicts"]>[number] = {
        id: conflict.id,
        path: conflict.path,
        kind: conflict.kind,
        message: conflict.message,
        resolutions: conflict.resolutions
      }

      if (options.artifacts) {
        entry.artifacts = `${options.artifacts}/conflicts/${artifactName(conflict.id)}`
      }

      return entry
    })
  }

  if (hasItems(plan.operations)) {
    envelope.operations = plan.operations.map((operation) => {
      const entry: NonNullable<Envelope["operations"]>[number] = {
        path: operation.path,
        action: operation.action,
        class: operation.class,
        linesAdded: operation.secret ? 0 : operation.linesAdded,
        linesRemoved: operation.secret ? 0 : operation.linesRemoved
      }

      if (operation.secret) {
        entry.secret = true
      }

      return entry
    })
  }

  if (hasItems(plan.pulled)) {
    envelope.pulled = plan.pulled
  }

  if (hasItems(plan.required)) {
    envelope.required = plan.required
  }

  if (hasItems(plan.packages)) {
    envelope.packages = plan.packages
  }

  if (hasItems(plan.env)) {
    envelope.env = plan.env
  }

  if (hasItems(plan.commands)) {
    envelope.commands = plan.commands
  }

  if (hasItems(plan.migrations)) {
    envelope.migrations = plan.migrations
  }

  if (hasItems(plan.merged)) {
    envelope.merged = plan.merged
  }

  if (
    plan.upgrade &&
    (plan.upgrade.addons.length > 0 ||
      plan.upgrade.packs.length > 0 ||
      plan.upgrade.catalog.from !== plan.upgrade.catalog.to)
  ) {
    envelope.upgrade = plan.upgrade
  }

  if (hasItems(plan.notices)) {
    envelope.notices = plan.notices
  }

  if (hasItems(plan.nextSteps)) {
    envelope.nextSteps = plan.nextSteps
  }

  if (options.artifacts) {
    envelope.artifacts = options.artifacts
  }

  if (plan.error) {
    envelope.error = plan.error
  }

  return envelope
}

/** A file-system-safe folder name for a conflict's artifacts. */
export function artifactName(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120)
}

/** 0 planned, applied or unchanged; 1 needs a decision; 3 conflict; 4 drift; 5 locked or interrupted; 6 applied, setup failed; 130 cancelled; 2 otherwise. */
export function exitCode(envelope: Pick<Envelope, "status" | "error" | "setup">): number {
  switch (envelope.status) {
    case "applied":
      return envelope.setup?.failed ? 6 : 0
    case "planned":
    case "unchanged":
      return 0
    case "needs-decision":
      return 1
    case "conflict":
      return 3
    case "error":
      switch (envelope.error?.code) {
        case "E_DRIFT":
          return 4
        case "E_LOCKED":
        case "E_INTERRUPTED":
          return 5
        case "E_CANCELLED":
          return 130
        default:
          return 2
      }
  }
}
