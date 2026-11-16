import { existsSync } from "node:fs"
import { join } from "node:path"
import * as prompts from "@clack/prompts"
import { resolveCommand } from "package-manager-detector/commands"
import pc from "picocolors"
import {
  DEFAULT_PRESET_CONFIG,
  encodePreset,
  PRESET_BASE_COLORS,
  PRESET_ICON_LIBRARIES,
  PRESET_STYLES
} from "shadcn/preset"
import * as z from "zod"
import { installedAdapters, publishedAdapters, type AdapterChoice } from "./adapters.js"
import { SyncError } from "./errors.js"
import { generatedName } from "./generate.js"
import { loadAdapter } from "./icons.js"
import { readJson } from "./json.js"
import {
  basePackage,
  bases,
  baseTitle,
  builtInIcons,
  defaultSettings,
  hasSettingFlags,
  isBuiltInIcons,
  parseSettings,
  styles,
  themes,
  titleCase,
  type SettingFlags,
  type SyncSettings
} from "./options.js"
import { detectPackageManager, outputFolder } from "./register.js"
import { findPackage } from "./resolve.js"
import {
  addedSyncScript,
  findSyncScriptIfAny,
  scriptFlags,
  withSettings,
  writeScript,
  type SyncScript
} from "./scripts.js"
import { snapshotFile } from "./snapshot.js"
import { run } from "./spawn.js"
import { sync, type SyncResult, type SyncStep } from "./sync.js"

/** Set while the installer installs packages, so the app's own `postinstall` sync waits for the installer's build. */
export const skipVariable = "SHADCN_SYNC_SKIP"

const syncPackage = "@buildkitgg/shadcn-sync"
const createUrl = "https://ui.shadcn.com/create"
const installEvents = new Set(["preinstall", "install", "postinstall", "prepare"])

/** Whether the CLI may ask questions: a person at a terminal, outside CI and outside an install. */
export function canAsk(): boolean {
  return (
    Boolean(process.stdin.isTTY && process.stdout.isTTY) &&
    !process.env.CI &&
    !installEvents.has(process.env.npm_lifecycle_event ?? "")
  )
}

export function print(line: string) {
  process.stdout.write(`shadcn-sync: ${line}\n`)
}

function plural(names: readonly string[], one: string, many: string) {
  return names.length === 1 ? one : many
}

function iconTitle(icons: string) {
  return builtInIcons.get(icons)?.title ?? icons
}

/** The packages the app is missing for the settings: runtime libraries, and build-time packages for devDependencies. */
async function missingPackages(settings: SyncSettings, appDirectory: string) {
  const primitives = basePackage(settings.base)
  const runtime = primitives ? [primitives] : []
  const build: string[] = []

  const app = readJson(
    join(appDirectory, "package.json"),
    z.looseObject({
      dependencies: z.record(z.string(), z.string()).optional(),
      devDependencies: z.record(z.string(), z.string()).optional()
    })
  )

  if (!{ ...app.dependencies, ...app.devDependencies }[syncPackage]) {
    build.push(syncPackage)
  }

  if (isBuiltInIcons(settings.icons)) {
    runtime.push(...(builtInIcons.get(settings.icons)?.packages ?? []))
  } else if (findPackage(settings.icons, appDirectory)) {
    runtime.push((await loadAdapter(settings.icons, appDirectory)).adapter.package)
  } else {
    build.push(settings.icons)
  }

  const missing = (names: readonly string[]) => names.filter((name) => !findPackage(name, appDirectory))

  return { runtime: missing(runtime), build }
}

type Missing = Awaited<ReturnType<typeof missingPackages>>

async function installCommands(missing: Missing, appDirectory: string) {
  const agent = await detectPackageManager(appDirectory)

  return [
    missing.runtime.length > 0 ? resolveCommand(agent, "add", missing.runtime) : undefined,
    missing.build.length > 0 ? resolveCommand(agent, "add", ["-D", ...missing.build]) : undefined
  ].flatMap((command) => (command ? [command] : []))
}

function commandText(command: { readonly command: string; readonly args: readonly string[] }) {
  return [command.command, ...command.args].join(" ")
}

async function install(missing: Missing, appDirectory: string) {
  for (const command of await installCommands(missing, appDirectory)) {
    const result = await run(command.command, command.args, {
      cwd: appDirectory,
      env: { ...process.env, [skipVariable]: "1" }
    })

    if (result.status !== 0) {
      throw new SyncError("dependency", `${commandText(command)} failed:\n${result.output.trim()}`)
    }
  }
}

const peersSchema = z.object({ peerDependencies: z.record(z.string(), z.string()).optional() })

function generatedPeers(appDirectory: string) {
  const path = join(appDirectory, outputFolder, "package.json")

  return existsSync(path) ? Object.keys(readJson(path, peersSchema).peerDependencies ?? {}) : []
}

/** A link to shadcn's theme builder showing the settings, built with shadcn's own preset encoding. */
export function previewUrl(settings: SyncSettings) {
  const color = PRESET_BASE_COLORS.find((entry) => entry === settings.theme) ?? DEFAULT_PRESET_CONFIG.baseColor

  // An adapter's icons have no preview, so the link shows the Lucide icons the adapter replaces.
  const preset = encodePreset({
    ...DEFAULT_PRESET_CONFIG,
    style: PRESET_STYLES.find((entry) => entry === settings.style) ?? DEFAULT_PRESET_CONFIG.style,
    baseColor: color,
    theme: color,
    iconLibrary: PRESET_ICON_LIBRARIES.find((entry) => entry === settings.icons) ?? DEFAULT_PRESET_CONFIG.iconLibrary
  })

  return `${createUrl}?preset=${preset}&base=${settings.base}`
}

/** What applying settings prints: plain lines for scripts, or the installer's frame in a terminal. */
interface Display {
  readonly interactive: boolean
  step(step: SyncStep): void
  done(label: string): void
  /** Stops the running step with a note instead of a failure, before asking something. */
  interrupt(label: string): void
  fail(): void
}

const stepLabels = new Map([
  ["record", ["Downloading components from shadcn", "Downloaded components from shadcn"]],
  ["replay", ["Installing components from the snapshot", "Installed components from the snapshot"]],
  ["rewrite", ["Rewriting imports and icons", "Rewrote imports and icons"]],
  ["javascript", ["Compiling JavaScript and types", "Compiled JavaScript and types"]],
  ["css", ["Compiling CSS", "Compiled CSS"]]
] as const)

/** One spinner per build step: each step's spinner stops with its finished label when the next one starts. */
function frameDisplay(): Display {
  let active: { spinner: prompts.SpinnerResult; running: string; finished: string } | undefined

  const finish = () => {
    active?.spinner.stop(active.finished)
    active = undefined
  }

  return {
    interactive: true,
    step: (step) => {
      const key = step.step === "catalog" ? step.mode : step.step
      const [running, finished] = stepLabels.get(key) ?? [key, key]
      const spinner = prompts.spinner()

      finish()
      spinner.start(running)
      active = { spinner, running, finished }
    },
    done: (label) => {
      finish()
      prompts.log.step(label)
    },
    interrupt: (label) => {
      active?.spinner.stop(label)
      active = undefined
    },
    fail: () => {
      active?.spinner.error(`${active.running} failed`)
      active = undefined
    }
  }
}

const plainDisplay: Display = {
  interactive: false,
  step: () => undefined,
  done: () => undefined,
  interrupt: () => undefined,
  fail: () => undefined
}

interface ApplyRequest {
  readonly appDirectory: string
  readonly settings: SyncSettings
  readonly script: SyncScript | undefined
  readonly previous: SyncSettings | undefined
  /** Install missing packages without asking. */
  readonly install: boolean
  readonly verbose: boolean
}

/**
 * Installs what the settings need, builds, and writes the settings into the sync script. Writes the script only after
 * the build passes, so a failure leaves the app's settings as they were.
 */
/**
 * Installs missing packages, asking first in a terminal unless `--yes` was given. Without a terminal or `--yes`, fails
 * with the commands to run. Returns false when the person would rather install them.
 */
async function installMissing(
  missing: Missing,
  request: ApplyRequest,
  display: Display,
  // Runs after the first install, for packages only known once others are in, such as an adapter's icon library.
  more: () => Promise<Missing> = async () => ({ runtime: [], build: [] })
): Promise<boolean> {
  const { appDirectory } = request
  const commands = (await installCommands(missing, appDirectory)).map(commandText)
  const names = [...missing.runtime, ...missing.build]

  if (!request.install && !display.interactive) {
    throw new SyncError(
      "dependency",
      `${names.join(", ")} ${plural(names, "isn't", "aren't")} installed. Install ${plural(names, "it", "them")}, then run this command again:\n${commands.map((line) => `  ${line}`).join("\n")}`
    )
  }

  if (!request.install) {
    const confirmed = answer(
      await prompts.select({
        message: `Install the packages these settings need?\n${pc.dim(commands.join("\n"))}`,
        options: [
          { value: true, label: "Yes" },
          { value: false, label: "No, I'll install them myself" }
        ]
      })
    )

    if (!confirmed) {
      prompts.outro("Nothing changed. Install the packages, then run shadcn-sync again.")

      return false
    }
  }

  const spinner = display.interactive ? prompts.spinner() : undefined

  spinner?.start(`Installing ${names.length} ${plural(names, "package", "packages")}`)

  let later: Missing

  try {
    await install(missing, appDirectory)
    const found = await more()
    const fresh = (list: readonly string[]) => list.filter((name) => !names.includes(name))

    later = { runtime: fresh(found.runtime), build: fresh(found.build) }
    await install(later, appDirectory)
  } catch (error) {
    spinner?.error("Installing packages failed")
    throw error
  }

  const installed = [...names, ...later.runtime, ...later.build]

  spinner?.stop(`Installed ${installed.length} ${plural(installed, "package", "packages")}`)

  return true
}

/**
 * Installs what the settings need, builds, and writes the settings into the sync script. Writes the script only after
 * the build passes, so a failure leaves the app's settings as they were. When the build finds the components import a
 * package the app lacks, such as a base's own libraries, it offers to install that too and builds again.
 */
async function apply(request: ApplyRequest, display: Display) {
  const { appDirectory, settings, verbose } = request
  const missing = await missingPackages(settings, appDirectory)

  if (
    (missing.runtime.length > 0 || missing.build.length > 0) &&
    !(await installMissing(missing, request, display, () => missingPackages(settings, appDirectory)))
  ) {
    return
  }

  const before = generatedPeers(appDirectory)
  const offered = new Set<string>()
  let result: SyncResult | undefined

  while (!result) {
    try {
      result = await sync({
        appDirectory,
        settings,
        force: true,
        verbose,
        progress: (step) => display.step(step),
        log: display.interactive ? () => undefined : (line) => process.stdout.write(`${line}\n`)
      })
    } catch (error) {
      const fresh = error instanceof SyncError ? error.missing.filter((name) => !offered.has(name)) : []

      if (fresh.length === 0 || (!request.install && !display.interactive)) {
        display.fail()
        throw error
      }

      display.interrupt(`The components also use ${fresh.join(", ")}`)

      for (const name of fresh) {
        offered.add(name)
      }

      if (!(await installMissing({ runtime: fresh, build: [] }, request, display))) {
        return
      }
    }
  }

  display.done(`Built ${result.count ?? 0} components`)

  const script = request.script
    ? { name: request.script.name, command: withSettings(request.script.command, settings) }
    : addedSyncScript(appDirectory, settings)

  const scriptChanged = request.script?.command !== script.command

  if (scriptChanged) {
    writeScript(appDirectory, script.name, script.command)
  }

  const after = new Set(generatedPeers(appDirectory))
  const unused = before.filter((name) => !after.has(name))

  const notes = [
    ...(unused.length > 0
      ? [
          `The components no longer use ${unused.join(", ")}. Remove ${plural(unused, "it", "them")} if nothing else in the app does.`
        ]
      : []),
    ...(request.previous && request.previous.base !== settings.base
      ? [
          `${baseTitle(request.previous.base)} and ${baseTitle(settings.base)} components take different props. Check the app's component code.`
        ]
      : [])
  ]

  const packageChanges = [
    ...(scriptChanged ? [`"${script.name}" script`] : []),
    ...(result.dependencyAdded ? [generatedName] : [])
  ]

  const changed = [
    ...(packageChanges.length > 0 ? [["package.json", packageChanges] as const] : []),
    ...(result.snapshotWritten ? [[snapshotFile, ["new registry snapshot"]] as const] : [])
  ]

  const files = changed.map(([file]) => file)
  const commit = files.length > 0 ? `Commit ${files.join(" and ")}.` : "Nothing to commit."

  if (!display.interactive) {
    if (scriptChanged) {
      print(`updated the "${script.name}" script. ${commit}`)
    }

    if (result.snapshotWritten && !scriptChanged) {
      print(`wrote ${snapshotFile}. Commit it with the app.`)
    }

    if (result.dependencyAdded) {
      print(`added ${generatedName} to package.json. Commit it with the lockfile after your next install.`)
    }

    for (const note of notes) {
      // Plain lines continue the "shadcn-sync:" prefix, so they start lowercase like the others.
      print(note.replace(/^The /, "the "))
    }

    return
  }

  prompts.log.step(`Linked ${generatedName}`)

  if (changed.length > 0) {
    const width = Math.max(...files.map((file) => file.length)) + 3

    prompts.note(
      changed
        .flatMap(([file, lines]) => lines.map((line, index) => `${(index === 0 ? file : "").padEnd(width)}${line}`))
        .join("\n"),
      "Changed"
    )
  }

  for (const note of notes) {
    prompts.log.warn(note)
  }

  prompts.log.message(
    `${pc.cyan(`import { Button } from "${generatedName}"`)}\n\nSee your choices at ${pc.underline(previewUrl(settings))}`
  )
  prompts.outro(`Done. ${commit}`)
}

class Canceled extends Error {}

/** A prompt's answer, or `Canceled` when the person pressed Ctrl+C: clack answers a cancel with a symbol. */
function answer(value: string | symbol): string
function answer(value: boolean | symbol): boolean
function answer(value: string | boolean | symbol) {
  if (prompts.isCancel(value)) {
    throw new Canceled()
  }

  return value
}

const anotherAdapter = "\0another"

async function askIcons(initial: string, appDirectory: string): Promise<string> {
  const spinner = prompts.spinner()

  spinner.start("Looking for icon adapters")

  const found = new Map<string, AdapterChoice>()

  for (const adapter of [...installedAdapters(appDirectory), ...(await publishedAdapters())]) {
    found.set(adapter.name, adapter)
  }

  spinner.clear()

  const adapters = [...found.values()]

  const choice = answer(
    await prompts.select({
      message: "Which icons?",
      initialValue: initial,
      options: [
        ...[...builtInIcons.entries()].map(([value, library]) => ({
          value,
          label: library.title,
          hint: library.packages.join(", ")
        })),
        ...adapters.map((adapter) => ({ value: adapter.name, label: adapter.name, hint: adapter.description })),
        ...(!isBuiltInIcons(initial) && !found.has(initial) ? [{ value: initial, label: initial }] : []),
        { value: anotherAdapter, label: "Another icon adapter…" }
      ]
    })
  )

  if (choice !== anotherAdapter) {
    return choice
  }

  return answer(
    await prompts.text({
      message: "Which icon adapter package?",
      placeholder: "@acme/shadcn-icons",
      validate: (value) => {
        const name = value?.trim() ?? ""

        try {
          parseSettings({ icons: name })
        } catch (error) {
          return error instanceof SyncError ? error.message : String(error)
        }

        return undefined
      }
    })
  ).trim()
}

/** Asks each setting that no flag gave, starting from the current answers. */
async function askSettings(current: SyncSettings, flags: SettingFlags, appDirectory: string): Promise<SyncSettings> {
  const base =
    flags.base ??
    answer(
      await prompts.select({
        message: "Which primitives should the components use?",
        initialValue: current.base,
        // The recommended base first, then the rest in shadcn's order.
        options: [defaultSettings.base, ...bases.filter((value) => value !== defaultSettings.base)].map((value) => ({
          value,
          label: value === defaultSettings.base ? `${baseTitle(value)} (Recommended)` : baseTitle(value)
        }))
      })
    )

  if (flags.style === undefined) {
    prompts.log.message(`Preview the styles at ${pc.underline(createUrl)}`)
  }

  const style =
    flags.style ??
    answer(
      await prompts.select({
        message: "Which style?",
        initialValue: current.style,
        options: styles.map((value) => ({ value, label: titleCase(value) }))
      })
    )

  const theme =
    flags.theme ??
    answer(
      await prompts.select({
        message: "Which color theme?",
        initialValue: current.theme,
        options: themes.map((value) => ({ value, label: titleCase(value) }))
      })
    )

  const icons = flags.icons ?? (await askIcons(current.icons, appDirectory))

  return parseSettings({ base, style, theme, icons, css: flags.css ?? current.css })
}

const labels = { base: "Primitives", style: "Style", theme: "Theme", icons: "Icons" } as const
const shownKeys = ["base", "style", "theme", "icons"] as const

function settingTitle(key: keyof typeof labels, settings: SyncSettings) {
  if (key === "base") {
    return baseTitle(settings.base)
  }

  return key === "icons" ? iconTitle(settings.icons) : titleCase(settings[key])
}

function settingsTable(settings: SyncSettings) {
  return shownKeys.map((key) => `${labels[key].padEnd(12)}${settingTitle(key, settings)}`).join("\n")
}

/** Asks to apply changed settings, showing each change. Returns false when nothing changed or the answer is no. */
async function confirmChanges(previous: SyncSettings, next: SyncSettings) {
  const keys = shownKeys.filter((key) => previous[key] !== next[key])

  if (keys.length === 0 && previous.css === next.css) {
    prompts.outro("Those are the current settings. Nothing changed.")

    return false
  }

  const lines = keys.map(
    (key) => `${labels[key].padEnd(12)}${settingTitle(key, previous)} → ${settingTitle(key, next)}`
  )

  const confirmed = answer(
    await prompts.select({
      message: `Apply these changes?\n${pc.dim(lines.join("\n"))}`,
      options: [
        { value: true, label: "Yes, rebuild" },
        { value: false, label: "No" }
      ]
    })
  )

  if (!confirmed) {
    prompts.outro("Nothing changed.")
  }

  return confirmed
}

/** Lists what an update changed in the registry. */
export function changeList(result: SyncResult): string | undefined {
  const changes = result.changes

  if (!changes || (changes.added.length === 0 && changes.removed.length === 0 && changes.changed.length === 0)) {
    return undefined
  }

  const name = (path: string) => path.replace(/^.*\//, "").replace(/\.json$/, "")

  return (
    [
      ["Added", changes.added],
      ["Removed", changes.removed],
      ["Changed", changes.changed]
    ] as const
  )
    .flatMap(([label, items]) => (items.length > 0 ? [`${label.padEnd(10)}${items.map(name).join(", ")}`] : []))
    .join("\n")
}

async function updateInFrame(appDirectory: string, settings: SyncSettings, verbose: boolean) {
  const display = frameDisplay()
  let result: SyncResult

  try {
    result = await sync({
      appDirectory,
      settings,
      refresh: true,
      force: true,
      verbose,
      progress: (step) => display.step(step),
      log: () => undefined
    })
  } catch (error) {
    display.fail()
    throw error
  }

  display.done(`Built ${result.count ?? 0} components`)

  const changes = changeList(result)

  if (!changes) {
    prompts.outro("You already have the latest components.")

    return
  }

  prompts.note(changes, "What changed")
  prompts.outro(`Done. Commit ${result.snapshotWritten ? snapshotFile : "package.json"}.`)
}

interface InstallerRequest {
  readonly appDirectory: string
  readonly flags: SettingFlags
  /** No questions: the current settings or the defaults, and install what's missing. */
  readonly yes: boolean
  readonly verbose: boolean
  /** Go straight to changing settings, as `set` with no options does. */
  readonly change?: boolean
}

/**
 * The installer: asks for each setting, installs what they need, builds, and writes the `postinstall`. In an app with
 * settings it first offers to rebuild, change settings, or get the latest components. Without a terminal, or with
 * `--yes`, it applies the flags over the current settings or the defaults without asking.
 */
export async function runInstaller(request: InstallerRequest) {
  const { appDirectory, flags, verbose } = request
  const script = findSyncScriptIfAny(appDirectory)
  const current = script ? parseSettings(scriptFlags(script.command)) : undefined

  if (request.yes || !canAsk()) {
    await apply(
      {
        appDirectory,
        settings: parseSettings(flags, current ?? defaultSettings),
        script,
        previous: current,
        install: request.yes,
        verbose
      },
      plainDisplay
    )

    return
  }

  prompts.intro(pc.inverse(" shadcn-sync "))

  try {
    let settings: SyncSettings

    if (current && !request.change && !hasSettingFlags(flags)) {
      prompts.note(settingsTable(current), "Current settings")

      const action = answer(
        await prompts.select({
          message: "What do you want to do?",
          options: [
            { value: "rebuild", label: "Rebuild" },
            { value: "change", label: "Change settings" },
            { value: "update", label: "Get the latest components from shadcn" }
          ]
        })
      )

      if (action === "update") {
        await updateInFrame(appDirectory, current, verbose)

        return
      }

      settings = action === "rebuild" ? current : await askSettings(current, flags, appDirectory)
    } else {
      settings = await askSettings(current ?? defaultSettings, flags, appDirectory)
    }

    if (current && settings !== current && !(await confirmChanges(current, settings))) {
      return
    }

    await apply({ appDirectory, settings, script, previous: current, install: false, verbose }, frameDisplay())
  } catch (error) {
    // A failure shows inside the frame and sets the exit code.
    if (error instanceof Canceled) {
      prompts.cancel("Canceled. Nothing changed.")
    } else if (error instanceof SyncError) {
      prompts.log.error(error.message)
      prompts.outro(error.previousKept ? "Previous output kept." : pc.dim(`Failed at the ${error.stage} stage.`))
      process.exitCode = 1
    } else {
      throw error
    }
  }
}
