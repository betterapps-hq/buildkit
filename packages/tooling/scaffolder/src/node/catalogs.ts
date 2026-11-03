import { spawn } from "node:child_process"
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join } from "node:path"
import { pathToFileURL } from "node:url"
import { z } from "zod"
import type { JsonValue } from "../edit/json.js"
import { writtenVersions } from "../manifest/catalog.js"
import { isTemplatePack, type LoadedPack } from "../manifest/packs.js"
import type { CatalogManifest } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { isRecord } from "../plan/json.js"
import type { ErrorCode } from "../plan/types.js"
import type { ProductSettings } from "../state/settings.js"
import { compareVersions, isValidRange, isValidVersion, satisfiesRange } from "../upgrade/semver.js"
import { withRetries } from "./fs.js"

export type CommandRunner = (command: string, args: string[], cwd: string) => Promise<{ code: number; output: string }>

const packageNamePattern = /^(?:@[a-z0-9][a-z0-9-._~]*\/)?[a-z0-9][a-z0-9-._~]*$/
const integritySchema = z.object({ name: z.string(), version: z.string(), integrity: z.string() })
const lockedPackageSchema = z.object({ integrity: z.string() })
const packageIdentitySchema = z.object({ name: z.string(), version: z.string() })
const stringField = z.string()

/** The fields every catalog has. The planner checks the rest. */
const catalogHeaderSchema = z.looseObject({
  id: z.string(),
  version: z.string(),
  facets: z.array(z.unknown()),
  targets: z.array(z.unknown()),
  templates: z.array(z.unknown()),
  addons: z.array(z.unknown())
})

/** A valid version in npm's output. */
function isVersion(entry: unknown): entry is string {
  const parsed = stringField.safeParse(entry)

  return parsed.success && isValidVersion(parsed.data)
}

export const runCommand: CommandRunner = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const stdio: ["ignore", "pipe", "pipe"] = ["ignore", "pipe", "pipe"]

    // npm is a .cmd file on Windows, which only cmd.exe runs. cmd.exe reads `^`, `&`, `|`, `<` and `>` in an unquoted
    // argument, and version ranges use them, so the command line quotes each argument.
    const child =
      process.platform === "win32"
        ? spawn(cmdLine(command, args), { cwd, shell: true, stdio })
        : spawn(command, args, { cwd, stdio })

    let output = ""
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()))
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()))
    child.on("error", reject)
    child.on("close", (code) => resolve({ code: code ?? 1, output }))
  })

/**
 * The cmd.exe command line that runs `<command>.cmd`. A bare name stays unquoted: cmd.exe gives a quoted batch file it
 * finds on PATH the current folder as %~dp0, and npm.cmd finds npm through it. A path is quoted, since it can have spaces.
 */
function cmdLine(command: string, args: readonly string[]): string {
  const name = /[\\/]/.test(command) ? cmdArgument(`${command}.cmd`) : `${command}.cmd`

  return [name, ...args.map(cmdArgument)].join(" ")
}

/** An argument quoted for cmd.exe. A quote or a `%` would still be read inside the quotes, so neither is allowed. */
function cmdArgument(argument: string): string {
  if (/["%\r\n]/.test(argument)) {
    throw new PlanError("E_USAGE", `${argument} can't be passed to npm on Windows. Remove its quotes and % signs.`)
  }

  // A backslash before the closing quote would escape it, so trailing backslashes are doubled.
  return `"${argument.replace(/(\\+)$/, "$1$1")}"`
}

/** A JSON file in the cache or a package folder. One that can't be read or parsed is reported with `code`. */
function readJson(path: string, code: ErrorCode): JsonValue {
  try {
    const value: JsonValue = JSON.parse(readFileSync(path, "utf8"))

    return value
  } catch (error) {
    throw new PlanError(code, `${path} can't be read: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function isCatalogManifest(value: unknown): value is CatalogManifest {
  return catalogHeaderSchema.safeParse(value).success
}

/**
 * The per-user cache folder for a product: `%LOCALAPPDATA%\<product>\Cache` on Windows, `~/Library/Caches/<product>`
 * on macOS, and `$XDG_CACHE_HOME/<product>` or `~/.cache/<product>` elsewhere.
 */
export function userCacheDir(settings: ProductSettings): string {
  const env = process.env

  if (env.XDG_CACHE_HOME) {
    return join(env.XDG_CACHE_HOME, settings.product)
  }

  if (process.platform === "win32") {
    return join(env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), settings.product, "Cache")
  }

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Caches", settings.product)
  }

  return join(homedir(), ".cache", settings.product)
}

/**
 * Earlier catalog versions, cached so old baselines render offline. Fetched packages are installed without running
 * their scripts, and each one's integrity is checked before its code is imported. The cache lives in the user's cache
 * folder, never in the project: a cloned repository could otherwise ship a cache, with its own integrity record, whose
 * code the CLI would import.
 */
export class CatalogStore {
  readonly #cacheRoot: string
  readonly #installed: CatalogManifest
  readonly #run: CommandRunner
  readonly #loaded = new Map<string, CatalogManifest>()

  constructor(options: { cacheRoot: string; installed: CatalogManifest; run?: CommandRunner }) {
    this.#cacheRoot = options.cacheRoot
    this.#installed = options.installed
    this.#run = options.run ?? runCommand
    this.#loaded.set(options.installed.version, options.installed)
  }

  folder(version: string): string {
    return join(this.#cacheRoot, "catalogs", ...this.#installed.id.split("/"), version)
  }

  /** A loaded catalog version, for the planner's `catalogs` lookup. */
  get(version: string): CatalogManifest | undefined {
    return this.#loaded.get(version)
  }

  #check(version: string) {
    if (!isValidVersion(version) || !packageNamePattern.test(this.#installed.id)) {
      throw new PlanError("E_USAGE", `${this.#installed.id}@${version} isn't a valid catalog version.`)
    }
  }

  /**
   * Downloads a catalog version into the cache and records its integrity. It installs beside the cached copy and
   * replaces it only after the install and the integrity check pass, so a failed fetch keeps what worked offline.
   */
  async fetch(
    version: string,
    expectedIntegrity?: string
  ): Promise<{ version: string; integrity: string; folder: string }> {
    this.#check(version)
    const folder = this.folder(version)

    const integrity = await installPackage(
      this.#run,
      folder,
      this.#installed.id,
      version,
      expectedIntegrity,
      "E_BASELINE_UNAVAILABLE"
    )

    this.#loaded.delete(version)

    return { version, integrity, folder }
  }

  /** Loads a cached version after checking its integrity. Returns `undefined` when it isn't cached. */
  async load(version: string, expectedIntegrity?: string): Promise<CatalogManifest | undefined> {
    const loaded = this.#loaded.get(version)

    if (loaded) {
      return loaded
    }

    this.#check(version)
    const folder = this.folder(version)
    const name = this.#installed.id

    if (cachedIntegrity(folder, name, expectedIntegrity, "E_BASELINE_UNAVAILABLE", "Fetch it again.") === undefined) {
      return undefined
    }

    const module = await importPackage(folder, name, "E_BASELINE_UNAVAILABLE")
    const catalog = isRecord(module) ? (module.default ?? module.catalog) : undefined

    if (!isCatalogManifest(catalog) || catalog.version !== version) {
      throw new PlanError("E_BASELINE_UNAVAILABLE", `${name}@${version} doesn't export a catalog for that version.`)
    }

    this.#loaded.set(version, catalog)

    return catalog
  }
}

/**
 * Template packages, cached like earlier catalog versions: npm installs each one into the user's cache folder, never
 * the project, without running its scripts, and its integrity is checked every time its code is imported.
 */
export class PackStore {
  readonly #cacheRoot: string
  readonly #run: CommandRunner
  readonly #loaded = new Map<string, LoadedPack>()

  constructor(options: { cacheRoot: string; run?: CommandRunner }) {
    this.#cacheRoot = options.cacheRoot
    this.#run = options.run ?? runCommand
  }

  folder(name: string, version: string): string {
    return join(this.#cacheRoot, "packs", ...name.split("/"), version)
  }

  async #view(name: string, spec: string, fields: string[]): Promise<JsonValue> {
    if (!packageNamePattern.test(name)) {
      throw new PlanError("E_USAGE", `${name} isn't a package name.`)
    }

    mkdirSync(this.#cacheRoot, { recursive: true })
    const result = await this.#run("npm", ["view", spec, ...fields, "--json"], this.#cacheRoot)

    if (result.code !== 0) {
      throw new PlanError(
        "E_PACKAGE_UNAVAILABLE",
        `Couldn't find ${spec} on npm: ${result.output.trim().split("\n").slice(-3).join(" ")}`
      )
    }

    return viewOutput(spec, result.output)
  }

  /** The newest published version in a range or dist-tag, such as `^2.0.0` or `latest`. */
  async resolve(name: string, range: string): Promise<string> {
    const [newest] = await this.#versionsOf(name, `${name}@${range}`, "version")

    if (newest === undefined) {
      throw new PlanError("E_PACKAGE_UNAVAILABLE", `No version of ${name} matches ${range}.`)
    }

    return newest
  }

  /** Every published version, newest first. */
  async versions(name: string): Promise<string[]> {
    return this.#versionsOf(name, name, "versions")
  }

  /** Every published version, with when it was published, as a timestamp, when npm says. */
  async published(name: string): Promise<{ version: string; time?: number }[]> {
    const value = await this.#view(name, name, ["versions", "time"])
    const times = isRecord(value) && isRecord(value.time) ? value.time : {}

    // A package with one version gives it as a string, not a list.
    return [isRecord(value) ? value.versions : []]
      .flat(2)
      .filter(isVersion)
      .map((version) => {
        const time = stringField.safeParse(times[version])
        const parsed = time.success ? Date.parse(time.data) : Number.NaN

        return Number.isNaN(parsed) ? { version } : { version, time: parsed }
      })
  }

  async #versionsOf(name: string, spec: string, field: string): Promise<string[]> {
    const value = await this.#view(name, spec, [field])

    // Some npm versions nest the list in another array.
    const list = (Array.isArray(value) ? value.flat() : [value]).filter(isVersion)

    return list.sort((left, right) => compareVersions(right, left))
  }

  /** Any package version's entry module, from the cache or fetched into it, after checking its integrity. */
  async import(
    name: string,
    version: string,
    expectedIntegrity?: string
  ): Promise<{ integrity: string; module: unknown }> {
    const key = `${name}@${version}`

    if (!packageNamePattern.test(name) || !isValidVersion(version)) {
      throw new PlanError("E_USAGE", `${key} isn't a package version.`)
    }

    const folder = this.folder(name, version)

    const integrity =
      cachedIntegrity(
        folder,
        name,
        expectedIntegrity,
        "E_PACKAGE_UNAVAILABLE",
        // No command fetches the same version again, so the cached copy has to go.
        `Delete ${folder} and run the command again.`
      ) ?? (await installPackage(this.#run, folder, name, version, expectedIntegrity, "E_PACKAGE_UNAVAILABLE"))

    return { integrity, module: await importPackage(folder, name, "E_PACKAGE_UNAVAILABLE") }
  }

  /**
   * A template package version, from the cache or fetched into it. A version the lock records comes with its integrity,
   * and a copy that doesn't match it is refused.
   */
  async load(name: string, version: string, expectedIntegrity?: string): Promise<LoadedPack> {
    const key = `${name}@${version}`
    const loaded = this.#loaded.get(key)

    if (loaded && (expectedIntegrity === undefined || loaded.integrity === expectedIntegrity)) {
      return loaded
    }

    const { integrity, module } = await this.import(name, version, expectedIntegrity)
    const pack = isRecord(module) ? module.default : undefined

    if (!isTemplatePack(pack)) {
      throw new PlanError(
        "E_INVALID_PACK",
        `${key} isn't a template package: its default export needs extends, templates and, optionally, add-ons.`
      )
    }

    const result = { name, version, integrity, pack }
    this.#loaded.set(key, result)

    return result
  }
}

const day = 24 * 60 * 60 * 1000

/**
 * `catalog check --registry`: asks npm for each of the catalog's pins, as it writes them. A pin fails when nothing published matches it,
 * when the newest match is younger than `minAge` days (default 1), and when an add-on's `packages` range doesn't
 * include the newest match. Pins that aren't ranges are left to `checkCatalog`.
 */
export async function checkRegistry(
  catalog: CatalogManifest,
  store: PackStore,
  options: { minAge?: number; now?: number } = {}
): Promise<string[]> {
  const minAge = options.minAge ?? 1
  const now = options.now ?? Date.now()
  // A `caret` catalog installs `^19.3.1` for a 19.3.1 pin, so the range it writes is what's checked.
  const pins = Object.entries(writtenVersions(catalog)).filter(([, pin]) => isValidRange(pin))
  const problems: string[][] = []

  // npm starts a process per package, so a few run at a time.
  for (let start = 0; start < pins.length; start += 8) {
    problems.push(
      ...(await Promise.all(
        pins.slice(start, start + 8).map(async ([name, pin]) => {
          let published: { version: string; time?: number }[]

          try {
            published = await store.published(name)
          } catch (error) {
            return [error instanceof Error ? error.message : String(error)]
          }

          const [newest] = published
            .filter((entry) => satisfiesRange(entry.version, pin))
            .sort((left, right) => compareVersions(right.version, left.version))

          if (newest === undefined) {
            return [`No published version of ${name} matches its pin "${pin}".`]
          }

          const found: string[] = []

          if (newest.time === undefined) {
            found.push(
              `npm doesn't say when ${name}@${newest.version}, the newest version "${pin}" allows, was published.`
            )
          } else if (now - newest.time < minAge * day) {
            found.push(
              `${name}@${newest.version}, the newest version "${pin}" allows, is less than ${minAge} day${minAge === 1 ? "" : "s"} old.`
            )
          }

          for (const addon of catalog.addons) {
            const range = addon.packages?.[name]

            if (range !== undefined && isValidRange(range) && !satisfiesRange(newest.version, range)) {
              found.push(`${addon.id} is written for ${name} ${range}, but the pin "${pin}" allows ${newest.version}.`)
            }
          }

          return found
        })
      ))
    )
  }

  return problems.flat()
}

/**
 * The JSON `npm view --json` printed. The runner merges stdout and stderr, so npm's warnings can surround it: the JSON
 * is the lines from the first that starts a JSON value to the last that ends one.
 */
function viewOutput(spec: string, output: string): JsonValue {
  const lines = output.trim().split(/\r?\n/)

  if (lines.length === 1 && lines[0] === "") {
    return []
  }

  const start = lines.findIndex((line) => /^\s*["[{]/.test(line))
  const end = lines.findLastIndex((line) => /["\]}]\s*$/.test(line))

  try {
    if (start !== -1 && end >= start) {
      const value: JsonValue = JSON.parse(lines.slice(start, end + 1).join("\n"))

      return value
    }
  } catch {
    // Reported below, with what npm printed.
  }

  throw new PlanError(
    "E_PACKAGE_UNAVAILABLE",
    `npm printed something other than JSON for ${spec}: ${lines.slice(-3).join(" ")}`
  )
}

/**
 * Installs a package version into a cache folder and records its integrity. It installs beside the cached copy and
 * replaces it only after the install and the integrity check pass, so a failed fetch keeps what worked offline.
 */
async function installPackage(
  run: CommandRunner,
  folder: string,
  name: string,
  version: string,
  expectedIntegrity: string | undefined,
  code: ErrorCode
): Promise<string> {
  const staging = `${folder}.partial`
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })

  try {
    writeFileSync(join(staging, "package.json"), `${JSON.stringify({ private: true }, null, 2)}\n`)
    const spec = `${name}@${version}`

    const result = await run(
      "npm",
      ["install", spec, "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact"],
      staging
    )

    if (result.code !== 0) {
      throw new PlanError(code, `Couldn't fetch ${spec}: ${result.output.trim().split("\n").slice(-3).join(" ")}`)
    }

    const integrity = lockedIntegrity(staging, name, code)

    if (expectedIntegrity !== undefined && integrity !== expectedIntegrity) {
      throw new PlanError(code, `${spec} doesn't match the integrity recorded in the lock, so it wasn't used.`)
    }

    writeFileSync(join(staging, "integrity.json"), `${JSON.stringify({ name, version, integrity }, null, 2)}\n`)
    rmSync(folder, { recursive: true, force: true })
    await withRetries(() => renameSync(staging, folder))

    return integrity
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw error
  }
}

function lockedIntegrity(folder: string, name: string, code: ErrorCode): string {
  const lock = readJson(join(folder, "package-lock.json"), code)
  const packages = isRecord(lock) && isRecord(lock.packages) ? lock.packages : {}
  const entry = lockedPackageSchema.safeParse(packages[`node_modules/${name}`])

  if (!entry.success) {
    throw new PlanError(code, `npm didn't record an integrity for ${name}.`)
  }

  return entry.data.integrity
}

/** A cached package's integrity, after checking it. `undefined` when it isn't cached. `remedy` says what to do on a mismatch. */
function cachedIntegrity(
  folder: string,
  name: string,
  expectedIntegrity: string | undefined,
  code: ErrorCode,
  remedy: string
): string | undefined {
  if (!statSync(join(folder, "integrity.json"), { throwIfNoEntry: false })) {
    return undefined
  }

  const recorded = integritySchema.safeParse(readJson(join(folder, "integrity.json"), code))
  const integrity = lockedIntegrity(folder, name, code)

  if (
    !recorded.success ||
    recorded.data.integrity !== integrity ||
    (expectedIntegrity !== undefined && integrity !== expectedIntegrity)
  ) {
    throw new PlanError(code, `The cached ${name}@${basename(folder)} failed its integrity check. ${remedy}`)
  }

  return integrity
}

/** A template package in a folder on disk, as its author checks it before publishing. Build it first. */
export async function loadLocalPack(folder: string): Promise<LoadedPack> {
  const identity = packageIdentitySchema.safeParse(readJson(join(folder, "package.json"), "E_INVALID_PACK"))

  if (!identity.success) {
    throw new PlanError("E_INVALID_PACK", `${join(folder, "package.json")} needs a name and a version.`)
  }

  const manifest = identity.data

  const module = await importEntry(folder, "E_INVALID_PACK")
  const pack = isRecord(module) ? module.default : undefined

  if (!isTemplatePack(pack)) {
    throw new PlanError(
      "E_INVALID_PACK",
      `${manifest.name} isn't a template package: its default export needs extends, templates and, optionally, add-ons.`
    )
  }

  return { name: manifest.name, version: manifest.version, pack }
}

// oxlint-disable-next-line anti-slop/no-unknown-returns -- a module's exports are decoded by each caller, as a catalog or a template package
function importPackage(folder: string, name: string, code: ErrorCode): Promise<unknown> {
  return importEntry(join(folder, "node_modules", ...name.split("/")), code)
}

/** A package folder's entry module. A package.json or a module that can't be read is reported with `code`. */
// oxlint-disable-next-line anti-slop/no-unknown-returns -- a module's exports are decoded by each caller, as a catalog or a template package
async function importEntry(packageFolder: string, code: ErrorCode): Promise<unknown> {
  const entry = join(packageFolder, entryFile(packageFolder, code))

  try {
    const module: unknown = await import(pathToFileURL(entry).href)

    return module
  } catch (error) {
    throw new PlanError(code, `${entry} can't be imported: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function entryFile(packageFolder: string, code: ErrorCode): string {
  const manifest = readJson(join(packageFolder, "package.json"), code)

  if (!isRecord(manifest)) {
    return "index.js"
  }

  const root = isRecord(manifest.exports) ? (manifest.exports["."] ?? manifest.exports) : manifest.exports

  return exportTarget(root) ?? stringField.safeParse(manifest.main).data ?? "index.js"
}

const importConditions = new Set(["node", "import", "module-sync", "default"])

/** The file an export resolves to for `import()` in Node: the first condition that matches, in the order written. */
function exportTarget(value: JsonValue | undefined): string | undefined {
  const target = stringField.safeParse(value)

  if (target.success) {
    return target.data
  }

  if (!isRecord(value)) {
    return undefined
  }

  for (const [condition, target] of Object.entries(value)) {
    const resolved = importConditions.has(condition) ? exportTarget(target) : undefined

    if (resolved !== undefined) {
      return resolved
    }
  }

  return undefined
}
