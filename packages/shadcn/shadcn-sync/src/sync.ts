import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import pc from "picocolors"
import postcss from "postcss"
import * as z from "zod"
import { checkTailwindStylesheet, compileStyles, tailwindStylesheet } from "./css.js"
import { SyncError } from "./errors.js"
import {
  checkDependencies,
  compileSources,
  isCurrent,
  peerRanges,
  syncDependencies,
  syncVersion,
  typescriptVersion,
  writeEntryPoints,
  writePackageFiles
} from "./generate.js"
import { loadAdapter, type LoadedAdapter } from "./icons.js"
import { canonicalJson, readJson } from "./json.js"
import { linkAll, linkMissing, packageTargets } from "./links.js"
import { baseTitle, isBuiltInIcons, registryStyle, type SyncSettings } from "./options.js"
import {
  assertRegistrable,
  dependencySpecifier,
  detectPackageManager,
  linkOutput,
  outputFolder,
  registerDependency
} from "./register.js"
import { findPackage, readManifest } from "./resolve.js"
import { createWorkspace, installCatalog, shadcnVersion, type RegistrySource } from "./shadcn.js"
import {
  compareSnapshots,
  createSnapshot,
  readSnapshot,
  snapshotFile,
  writeSnapshot,
  type RegistrySnapshot
} from "./snapshot.js"
import { importStyles, prepareSources, sharedStylesheet, type PreparedSources } from "./sources.js"

/** What a sync run is asked to do. */
export interface SyncRequest {
  readonly appDirectory: string
  readonly settings: SyncSettings
  /** Record a fresh snapshot from the live registry, as `update` does. */
  readonly refresh?: boolean
  /** Regenerate even when the output is current. */
  readonly force?: boolean
  readonly verbose?: boolean
  readonly log?: (line: string) => void
  /** Called as each long step starts, so a caller can show progress. */
  readonly progress?: (step: SyncStep) => void
}

/** The long steps of a build, in order. `catalog` downloads from the registry when recording. */
export type SyncStep =
  | { readonly step: "catalog"; readonly mode: RegistrySource["mode"] }
  | { readonly step: "rewrite" | "css" | "javascript" }

/** What a sync run did. */
export interface SyncResult {
  readonly built: boolean
  readonly snapshotWritten: boolean
  readonly dependencyAdded: boolean
  readonly linked: boolean
  /** How many components the build produced, when it built. */
  readonly count?: number
  readonly changes?: ReturnType<typeof compareSnapshots>
}

const tailwindVersion = readJson(
  createRequire(import.meta.url).resolve("tailwindcss/package.json"),
  z.object({ version: z.string() })
).version

function snapshotMatches(snapshot: RegistrySnapshot, settings: SyncSettings) {
  return snapshot.style === registryStyle(settings) && snapshot.theme === settings.theme
}

function iconVersion(settings: SyncSettings, adapter: LoadedAdapter | undefined, appDirectory: string) {
  if (adapter) {
    const library = findPackage(adapter.adapter.package, appDirectory)

    return `${adapter.name}@${adapter.version}+${adapter.adapter.package}@${library ? readManifest(library).version : "missing"}`
  }

  return settings.icons
}

function fingerprint(settings: SyncSettings, snapshot: RegistrySnapshot, icons: string) {
  const identity = canonicalJson({
    settings: { ...settings },
    snapshot: snapshot.hash,
    sync: syncVersion,
    shadcn: shadcnVersion,
    icons,
    typescript: typescriptVersion,
    tailwindcss: tailwindVersion
  })

  return `sha256-${createHash("sha256").update(identity).digest("base64")}`
}

/** Removes a folder, tolerating Windows keeping a handle open for a moment. */
function remove(path: string) {
  rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}

/**
 * Builds the generated package from the snapshot, recording a new snapshot first when there's none, when the settings
 * need different registry items, or when refreshing. Builds into a staging folder and swaps it in only after it
 * validates, so any failure leaves the previous output and snapshot alone.
 */
export async function sync(request: SyncRequest): Promise<SyncResult> {
  const { settings, verbose = false } = request
  const appDirectory = resolve(request.appDirectory)
  const log = request.log ?? ((line: string) => process.stdout.write(`${line}\n`))

  const stage = (line: string) => {
    if (verbose) {
      log(pc.dim(`shadcn-sync: ${line}`))
    }
  }

  if (!existsSync(join(appDirectory, "package.json"))) {
    throw new SyncError("configuration", `${appDirectory} has no package.json. Run sync from the app's folder.`)
  }

  const snapshotPath = join(appDirectory, snapshotFile)
  const existing = readSnapshot(snapshotPath)
  const needsRecord = request.refresh || !existing || !snapshotMatches(existing, settings)

  if (needsRecord && process.env.CI && !request.refresh) {
    throw new SyncError(
      "registry",
      `${snapshotFile} is missing or doesn't match --base ${settings.base}, --style ${settings.style} and --theme ${settings.theme}, and CI is set.\nRun an install locally and commit ${snapshotFile}.`
    )
  }

  const specifier = dependencySpecifier(await detectPackageManager(appDirectory))

  assertRegistrable(appDirectory, specifier)

  const adapter = isBuiltInIcons(settings.icons) ? undefined : await loadAdapter(settings.icons, appDirectory)
  const output = join(appDirectory, outputFolder)
  const icons = iconVersion(settings, adapter, appDirectory)

  if (!needsRecord && existing && !request.force && isCurrent(output, fingerprint(settings, existing, icons))) {
    stage("output is current")

    return { built: false, snapshotWritten: false, ...register(appDirectory, specifier) }
  }

  // TypeScript won't name a package in a declaration through a path like node_modules/.buildkit/<dir>/node_modules,
  // so the build runs in a temp folder outside the app, with every package it needs linked in.
  const work = join(tmpdir(), "shadcn-sync", createHash("sha256").update(appDirectory).digest("hex").slice(0, 16))
  const staging = join(appDirectory, "node_modules/.buildkit/shadcn.staging")
  const source: RegistrySource = needsRecord || !existing ? { mode: "record" } : { mode: "replay", snapshot: existing }
  const progress = request.progress ?? (() => undefined)
  const build = { appDirectory, settings, source, adapter, icons, work, staging, verbose, stage, progress }
  let built: StagedBuild

  try {
    built = await buildStaging(build)
  } catch (error) {
    remove(staging)

    throw error instanceof SyncError ? error.keptPrevious() : error
  }

  // Swap the staging folder in, then the snapshot: nothing before this point touched the previous output.
  const previous = `${output}.previous`

  remove(previous)

  if (existsSync(output)) {
    renameSync(output, previous)
  }

  mkdirSync(join(output, ".."), { recursive: true })
  renameSync(staging, output)
  remove(previous)

  const snapshotWritten = source.mode === "record" && existing?.hash !== built.snapshot.hash

  if (snapshotWritten) {
    writeSnapshot(snapshotPath, built.snapshot)
  }

  remove(work)
  log(
    `shadcn-sync: built ${built.count} components (${baseTitle(settings.base)}, ${settings.style}, ${settings.theme}, ${settings.icons} icons).`
  )

  const result: SyncResult = { built: true, snapshotWritten, count: built.count, ...register(appDirectory, specifier) }

  return source.mode === "record" ? { ...result, changes: compareSnapshots(existing, built.snapshot) } : result
}

/** What `buildStaging` works from. */
interface StagingBuild {
  readonly appDirectory: string
  readonly settings: SyncSettings
  readonly source: RegistrySource
  readonly adapter: LoadedAdapter | undefined
  readonly icons: string
  readonly work: string
  readonly staging: string
  readonly verbose: boolean
  readonly stage: (line: string) => void
  readonly progress: (step: SyncStep) => void
}

/** A validated package in the staging folder, and the snapshot it was built from. */
interface StagedBuild {
  readonly snapshot: RegistrySnapshot
  readonly count: number
}

/** Installs, rewrites, compiles and validates the package into the staging folder. */
async function buildStaging(build: StagingBuild): Promise<StagedBuild> {
  const { settings, source, adapter, work, staging, stage, progress } = build

  stage(`installing the ${registryStyle(settings)} catalog with shadcn ${shadcnVersion} (${source.mode})`)
  progress({ step: "catalog", mode: source.mode })
  createWorkspace(work, settings)
  // The build reads sync's own packages, such as Tailwind, shadcn's CSS and React's types, from the temp project.
  linkAll(work, packageTargets([...syncDependencies, "react", "react-dom"], build.appDirectory))

  const responses = await installCatalog(work, settings, source, build.verbose)

  const snapshot =
    source.mode === "replay"
      ? source.snapshot
      : createSnapshot(registryStyle(settings), settings.theme, shadcnVersion, responses)

  stage("rewriting imports and icons")
  progress({ step: "rewrite" })

  const sourceRoot = join(work, "src")
  const prepared = prepareSources(sourceRoot, adapter?.adapter, settings.icons)

  const targets = packageTargets(prepared.packages, build.appDirectory, true)

  linkAll(work, targets)
  // TypeScript names a package in a declaration through a link only after resolving an import through that link, and
  // nothing imports a dependency such as @react-types/shared directly. This unemitted file imports each one.
  writeFileSync(
    join(work, "src/shadcn-sync-links.d.ts"),
    [...targets.keys()].map((name) => `import type {} from ${JSON.stringify(name)}\n`).join("")
  )
  checkDependencies(prepared.packages, work)
  stage("compiling CSS")
  progress({ step: "css" })

  const all = new Set([...prepared.candidates.values()].flatMap((words) => [...words]))

  const cliCss = readFileSync(join(sourceRoot, "index.css"), "utf8")

  const css =
    settings.css === "tailwind"
      ? await tailwindCss(build, cliCss, all)
      : await compiledCss(build, prepared, cliCss, all)

  if (css.mode === "compiled") {
    importStyles(prepared, sourceRoot, new Set(css.shared.keys()))
  }

  await prepared.project.save()
  writeEntryPoints(sourceRoot, prepared.components, prepared.shared)
  stage("compiling JavaScript and declarations")
  progress({ step: "javascript" })
  remove(staging)
  await compileSources(sourceRoot, staging)
  linkMissing(staging, targets, build.appDirectory)

  if (css.mode === "tailwind") {
    writeFileSync(join(staging, "tailwind.css"), css.stylesheet)
    stage("wrote tailwind.css")
  } else {
    writeFileSync(join(staging, "shared.css"), css.styles.shared)

    for (const component of prepared.components) {
      writeFileSync(
        join(staging, "components", component.name, "styles.css"),
        css.styles.components.get(component.name) ?? ""
      )
    }

    for (const [module, stylesheet] of css.shared) {
      writeFileSync(join(staging, sharedStylesheet(module)), stylesheet)
    }

    stage(`wrote ${prepared.components.length + css.shared.size} stylesheets in ${css.styles.layers} utility layers`)
  }

  writePackageFiles(staging, prepared.components, prepared.shared, peerRanges(prepared.packages, build.appDirectory), {
    generatorVersion: syncVersion,
    settings,
    snapshot: snapshot.hash,
    fingerprint: fingerprint(settings, snapshot, build.icons)
  })

  return { snapshot, count: prepared.components.length }
}

/** The stylesheet a Tailwind mode build exports, checked by compiling it after Tailwind with every component class. */
async function tailwindCss(build: StagingBuild, cliCss: string, candidates: ReadonlySet<string>) {
  const sourceRoot = join(build.work, "src")
  const stylesheet = tailwindStylesheet(cliCss, sourceRoot, build.adapter?.adapter.styles)

  await checkTailwindStylesheet(stylesheet, sourceRoot, candidates)

  return { mode: "tailwind" as const, stylesheet }
}

/**
 * The compiled stylesheets: one per component, and one for each `hooks/` or `lib/` module whose classes compile to
 * rules, such as the highlighter's token colors.
 */
async function compiledCss(
  build: StagingBuild,
  prepared: PreparedSources,
  cliCss: string,
  candidates: ReadonlySet<string>
) {
  const words = (paths: readonly string[]) =>
    new Set(paths.flatMap((path) => [...(prepared.candidates.get(path) ?? [])]))

  const perModule = new Map([
    ...prepared.components.map((component) => [component.name, words(component.modules)] as const),
    ...prepared.shared.map((module) => [module.path, words([module.path])] as const)
  ])

  const styles = await compileStyles(
    cliCss,
    join(build.work, "src"),
    candidates,
    perModule,
    build.adapter?.adapter.styles
  )

  const shared = new Map(
    prepared.shared.flatMap((module) => {
      const stylesheet = styles.components.get(module.path)

      return stylesheet && postcss.parse(stylesheet).some((node) => node.type === "atrule" && Boolean(node.nodes))
        ? [[module.path, stylesheet] as const]
        : []
    })
  )

  return { mode: "compiled" as const, styles, shared }
}

function register(appDirectory: string, specifier: string | undefined) {
  return { dependencyAdded: registerDependency(appDirectory, specifier), linked: linkOutput(appDirectory) }
}
