import { lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { detect } from "package-manager-detector/detect"
import * as z from "zod"
import { SyncError } from "./errors.js"
import { generatedName } from "./generate.js"
import { json } from "./json.js"

/** Where sync writes the generated package, inside the app's own `node_modules`. */
export const outputFolder = "node_modules/.buildkit/shadcn"

/** The package managers sync writes a dependency specifier for. */
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun"

/** Detects the package manager from the running install, then the `packageManager` field and lockfiles. */
export async function detectPackageManager(appDirectory: string): Promise<PackageManager> {
  const running = process.env.npm_config_user_agent?.split("/")[0]

  const agent =
    running ??
    (await detect({ cwd: appDirectory, strategies: ["packageManager-field", "devEngines-field", "lockfile"] }))?.name

  return agent === "pnpm" || agent === "yarn" || agent === "bun" ? agent : "npm"
}

/**
 * The local-folder protocol each package manager links rather than copies, and accepts before sync has written the
 * folder. Yarn's `portal:` reads the folder's manifest while resolving, so a fresh install fails; its `link:` doesn't.
 * Bun refuses every local protocol whose folder doesn't exist yet, so with Bun there's no entry and sync's own link is
 * the only one.
 */
export function dependencySpecifier(manager: PackageManager) {
  const protocols = new Map([
    ["pnpm", "link:"],
    ["yarn", "link:"],
    ["npm", "file:"]
  ])

  const protocol = protocols.get(manager)

  return protocol ? `${protocol}${outputFolder}` : undefined
}

const dependenciesSchema = z.record(z.string(), z.string()).optional()

/**
 * What sync says after adding the generated package to `package.json`. pnpm skips an install when `package.json` hasn't
 * changed since the last one, and a change made during an install counts as before it, so after a pnpm install the
 * next plain `pnpm install` wouldn't record the entry in the lockfile.
 */
export function dependencyAddedMessage() {
  const duringPnpmInstall =
    Boolean(process.env.npm_lifecycle_event) && process.env.npm_config_user_agent?.startsWith("pnpm/") === true

  return duringPnpmInstall
    ? `added ${generatedName} to package.json during this install, which a plain pnpm install won't notice. Run pnpm install --config.optimistic-repeat-install=false to add it to the lockfile, then commit package.json and the lockfile.`
    : `added ${generatedName} to package.json. Commit it with the lockfile after your next install.`
}

/** Reads `package.json` as written, so rewriting it keeps every key where it was. */
export function readPackageJson(appDirectory: string) {
  const text = readFileSync(join(appDirectory, "package.json"), "utf8")

  return {
    indent: /^[ \t]+(?=")/m.exec(text)?.[0] ?? "  ",
    newline: text.endsWith("\n"),
    value: z.record(z.string(), json).parse(JSON.parse(text))
  }
}

/**
 * Whether `package.json` needs the generated package's entry written. In CI it fails instead: a frozen-lockfile install
 * would fail anyway, and this says why. Sync checks it before building, so CI fails fast.
 */
export function assertRegistrable(appDirectory: string, specifier: string | undefined): boolean {
  if (
    !specifier ||
    dependenciesSchema.parse(readPackageJson(appDirectory).value.dependencies)?.[generatedName] === specifier
  ) {
    return false
  }

  if (process.env.CI) {
    throw new SyncError(
      "registration",
      `${generatedName} is missing from package.json, and CI is set.\nRun an install locally and commit package.json and the lockfile.`
    )
  }

  return true
}

/**
 * Makes sure the app's `package.json` lists the generated package with the right specifier. Writes only when the entry
 * is missing or points elsewhere, keeping the file's indentation, key order and final newline. Returns whether it wrote.
 */
export function registerDependency(appDirectory: string, specifier: string | undefined): boolean {
  if (!specifier || !assertRegistrable(appDirectory, specifier)) {
    return false
  }

  const { indent, newline, value } = readPackageJson(appDirectory)
  const current = dependenciesSchema.parse(value.dependencies) ?? {}
  const names = Object.keys(current)
  const sorted = names.every((name, index) => index === 0 || (names[index - 1] ?? "") <= name)
  const entries = Object.entries({ ...current, [generatedName]: specifier })
  const dependencies = Object.fromEntries(sorted ? entries.toSorted(([a], [b]) => (a < b ? -1 : 1)) : entries)

  writeFileSync(
    join(appDirectory, "package.json"),
    JSON.stringify({ ...value, dependencies }, null, indent) + (newline ? "\n" : "")
  )

  return true
}

function resolvesTo(link: string, target: string) {
  try {
    return realpathSync(link) === realpathSync(target)
  } catch {
    return false
  }
}

function present(path: string) {
  try {
    lstatSync(path)

    return true
  } catch {
    return false
  }
}

/**
 * Makes `node_modules/@buildkitgg/shadcn` resolve to the output, repairing it when the package manager copied the
 * folder or left the link dangling. Returns whether it changed anything.
 */
export function linkOutput(appDirectory: string): boolean {
  const target = join(appDirectory, outputFolder)
  const link = join(appDirectory, "node_modules", ...generatedName.split("/"))

  if (resolvesTo(link, target)) {
    return false
  }

  if (present(link)) {
    rmSync(link, { recursive: true, force: true })
  }

  mkdirSync(dirname(link), { recursive: true })
  // Junctions need no elevation on Windows and take an absolute target; elsewhere a relative link survives moves.
  symlinkSync(
    process.platform === "win32" ? target : relative(dirname(link), target).split(sep).join("/"),
    link,
    "junction"
  )

  return true
}
