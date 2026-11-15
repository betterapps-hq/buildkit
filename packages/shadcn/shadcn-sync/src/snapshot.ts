import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import * as z from "zod"
import { SyncError } from "./errors.js"
import { canonicalJson, json, type Json } from "./json.js"

export const snapshotFile = "shadcn-registry.json"
export const registryUrl = "https://ui.shadcn.com/r"

/** Registry responses keyed by their path under the registry URL, such as `styles/base-nova/button.json`. */
export type RegistryResponses = Readonly<Record<string, Json>>

/** `shadcn-registry.json`: every registry response the shadcn CLI received while installing the catalog. */
export interface RegistrySnapshot {
  readonly registry: string
  /** The registry style, such as `base-nova`. */
  readonly style: string
  readonly theme: string
  /** The shadcn CLI version that made the requests. */
  readonly shadcn: string
  readonly hash: string
  readonly responses: RegistryResponses
}

const snapshotSchema = z.object({
  registry: z.string(),
  style: z.string(),
  theme: z.string(),
  shadcn: z.string(),
  hash: z.string(),
  responses: z.record(z.string(), json)
})

/** Hashes the responses' content, so reformatting the file keeps the hash valid and editing a value doesn't. */
export function hashResponses(responses: RegistryResponses): string {
  return `sha256-${createHash("sha256").update(canonicalJson(responses)).digest("base64")}`
}

export function createSnapshot(
  style: string,
  theme: string,
  shadcn: string,
  responses: RegistryResponses
): RegistrySnapshot {
  const sorted = Object.fromEntries(Object.entries(responses).toSorted(([a], [b]) => (a < b ? -1 : 1)))

  return { registry: registryUrl, style, theme, shadcn, hash: hashResponses(sorted), responses: sorted }
}

/** Reads and checks the snapshot, or returns undefined when the app has none yet. */
export function readSnapshot(path: string): RegistrySnapshot | undefined {
  if (!existsSync(path)) {
    return undefined
  }

  const parsed = snapshotSchema.safeParse(JSON.parse(readFileSync(path, "utf8")))

  if (!parsed.success || hashResponses(parsed.data.responses) !== parsed.data.hash) {
    throw new SyncError(
      "registry",
      `${snapshotFile} was edited by hand.\nRestore it from git, or run update to fetch a fresh copy.`
    )
  }

  return parsed.data
}

export function writeSnapshot(path: string, snapshot: RegistrySnapshot) {
  writeFileSync(path, JSON.stringify(snapshot, null, 2) + "\n")
}

/** The items whose responses differ between two snapshots. */
export function compareSnapshots(before: RegistrySnapshot | undefined, after: RegistrySnapshot) {
  const previous = before?.responses ?? {}
  const keys = (responses: RegistryResponses) => Object.keys(responses)

  return {
    added: keys(after.responses).filter((key) => !Object.hasOwn(previous, key)),
    removed: keys(previous).filter((key) => !Object.hasOwn(after.responses, key)),
    changed: keys(after.responses).filter(
      (key) =>
        Object.hasOwn(previous, key) &&
        canonicalJson(previous[key] ?? null) !== canonicalJson(after.responses[key] ?? null)
    )
  }
}
