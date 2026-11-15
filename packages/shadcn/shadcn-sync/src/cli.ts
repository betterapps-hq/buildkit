import { existsSync } from "node:fs"
import { join } from "node:path"
import * as prompts from "@clack/prompts"
import { defineCommand, runMain } from "citty"
import { resolveCommand } from "package-manager-detector/commands"
import pc from "picocolors"
import * as z from "zod"
import { SyncError } from "./errors.js"
import { generatedName } from "./generate.js"
import { loadAdapter } from "./icons.js"
import { readJson } from "./json.js"
import {
  bases,
  builtInIcons,
  cssModes,
  isBuiltInIcons,
  parseSettings,
  styles,
  type SettingFlags,
  type SyncSettings
} from "./options.js"
import { detectPackageManager, outputFolder } from "./register.js"
import { findPackage } from "./resolve.js"
import { findSyncScript, scriptFlags, withSettings, writeScript } from "./scripts.js"
import { snapshotFile } from "./snapshot.js"
import { sync, type SyncResult } from "./sync.js"

const settingArgs = {
  base: { type: "string", description: "Primitives: base-ui or radix", valueHint: "base" },
  icons: { type: "string", description: "Icon library id, or an icon adapter's package name", valueHint: "library" },
  style: { type: "string", description: "Upstream style, such as nova or vega", valueHint: "style" },
  theme: { type: "string", description: "Upstream color theme, such as neutral", valueHint: "theme" },
  css: { type: "string", description: "CSS mode: compiled", valueHint: "mode" }
} as const

const verboseArg = { verbose: { type: "boolean", description: "Log each stage", default: false } } as const

/** The npm packages each built-in icon library's generated code imports. */
const iconPackages: Readonly<Record<(typeof builtInIcons)[number], readonly string[]>> = {
  lucide: ["lucide-react"],
  tabler: ["@tabler/icons-react"],
  hugeicons: ["@hugeicons/react", "@hugeicons/core-free-icons"],
  phosphor: ["@phosphor-icons/react"],
  remixicon: ["@remixicon/react"]
}

function print(line: string) {
  process.stdout.write(`buildkit-shadcn: ${line}\n`)
}

function report(result: SyncResult) {
  if (result.snapshotWritten) {
    print(`wrote ${snapshotFile}. Commit it with the app.`)
  }

  if (result.dependencyAdded) {
    print(`added ${generatedName} to package.json. Commit it with the lockfile after your next install.`)
  }
}

async function run(task: () => Promise<void>) {
  try {
    await task()
  } catch (error) {
    if (!(error instanceof SyncError)) {
      throw error
    }

    process.stderr.write(
      `${pc.red("buildkit-shadcn:")} ${error.message}${error.previousKept ? " Previous output kept." : ""}\n${pc.dim(`Failed at the ${error.stage} stage.`)}\n`
    )
    process.exitCode = 1
  }
}

const syncCommand = defineCommand({
  meta: { name: "sync", description: "Build @buildkitgg/shadcn from shadcn-registry.json" },
  args: {
    ...settingArgs,
    force: { type: "boolean", description: "Regenerate even when the output is current", default: false },
    ...verboseArg
  },
  run: ({ args }) =>
    run(async () => {
      const settings = parseSettings(args)

      report(await sync({ appDirectory: process.cwd(), settings, force: args.force, verbose: args.verbose }))
    })
})

function listChanges(result: SyncResult) {
  const changes = result.changes

  if (!changes || (changes.added.length === 0 && changes.removed.length === 0 && changes.changed.length === 0)) {
    print("the registry hasn't changed.")

    return
  }

  for (const [label, items] of [
    ["Added", changes.added],
    ["Removed", changes.removed],
    ["Changed", changes.changed]
  ] as const) {
    if (items.length > 0) {
      process.stdout.write(`${label}:\n${items.map((item) => `  ${item}`).join("\n")}\n`)
    }
  }
}

const updateCommand = defineCommand({
  meta: { name: "update", description: "Record a fresh snapshot from the live registry and rebuild" },
  args: verboseArg,
  run: ({ args }) =>
    run(async () => {
      const appDirectory = process.cwd()
      const settings = parseSettings(scriptFlags(findSyncScript(appDirectory).command))
      const result = await sync({ appDirectory, settings, refresh: true, force: true, verbose: args.verbose })

      listChanges(result)
      report(result)
    })
})

async function askSettings(current: SyncSettings): Promise<SettingFlags> {
  const answer = (value: string | symbol): string => {
    if (prompts.isCancel(value)) {
      throw new SyncError("configuration", "Canceled. Nothing changed.")
    }

    return String(value)
  }

  const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }))

  return {
    base: answer(await prompts.select({ message: "Primitives", options: options(bases), initialValue: current.base })),
    icons: answer(
      await prompts.text({
        message: `Icon library (${builtInIcons.join(", ")}, or an adapter package)`,
        initialValue: current.icons
      })
    ),
    style: answer(await prompts.select({ message: "Style", options: options(styles), initialValue: current.style })),
    theme: answer(await prompts.text({ message: "Color theme", initialValue: current.theme })),
    css: answer(await prompts.select({ message: "CSS", options: options(cssModes), initialValue: current.css }))
  }
}

/**
 * The packages the app must have installed for the settings, which `set` checks before building: the primitives and
 * icon library the components import, and the icon adapter sync reads at build time.
 */
async function requiredPackages(settings: SyncSettings, appDirectory: string) {
  const primitives = settings.base === "base-ui" ? "@base-ui/react" : "radix-ui"

  if (isBuiltInIcons(settings.icons)) {
    const library = Object.entries(iconPackages).find(([id]) => id === settings.icons)?.[1] ?? []

    return { runtime: [primitives, ...library], build: [] }
  }

  const adapter = findPackage(settings.icons, appDirectory)
    ? await loadAdapter(settings.icons, appDirectory)
    : undefined

  return { runtime: [primitives, ...(adapter ? [adapter.adapter.package] : [])], build: [settings.icons] }
}

function plural(names: readonly string[], one: string, many: string) {
  return names.length === 1 ? one : many
}

const peersSchema = z.object({ peerDependencies: z.record(z.string(), z.string()).optional() })

function generatedPeers(appDirectory: string) {
  const path = join(appDirectory, outputFolder, "package.json")

  return existsSync(path) ? Object.keys(readJson(path, peersSchema).peerDependencies ?? {}) : []
}

const setCommand = defineCommand({
  meta: {
    name: "set",
    description: "Change the settings in package.json and rebuild. With no options, asks for each setting"
  },
  args: { ...settingArgs, ...verboseArg },
  run: ({ args }) =>
    run(async () => {
      const appDirectory = process.cwd()
      const script = findSyncScript(appDirectory)
      const current = parseSettings(scriptFlags(script.command))
      const given = [args.base, args.icons, args.style, args.theme, args.css].some((value) => value !== undefined)
      const settings = parseSettings(given ? args : await askSettings(current), current)
      const required = await requiredPackages(settings, appDirectory)
      const runtime = required.runtime.filter((name) => !findPackage(name, appDirectory))
      const build = required.build.filter((name) => !findPackage(name, appDirectory))
      const missing = [...runtime, ...build]

      if (missing.length > 0) {
        const agent = await detectPackageManager(appDirectory)

        const commands = [
          runtime.length > 0 ? resolveCommand(agent, "add", runtime) : undefined,
          build.length > 0 ? resolveCommand(agent, "add", ["-D", ...build]) : undefined
        ].flatMap((command) => (command ? [`  ${[command.command, ...command.args].join(" ")}`] : []))

        throw new SyncError(
          "dependency",
          `${missing.join(", ")} ${plural(missing, "isn't", "aren't")} installed. Install ${plural(missing, "it", "them")}, then run set again:\n${commands.join("\n")}`
        )
      }

      const before = generatedPeers(appDirectory)
      const result = await sync({ appDirectory, settings, force: true, verbose: args.verbose })

      writeScript(appDirectory, script.name, withSettings(script.command, settings))
      print(
        `updated the "${script.name}" script. Commit package.json${result.snapshotWritten ? ` and ${snapshotFile}` : ""}.`
      )
      report(result)

      const after = new Set(generatedPeers(appDirectory))
      const unused = before.filter((name) => !after.has(name))

      if (unused.length > 0) {
        print(
          `the components no longer import ${unused.join(", ")}. Remove ${plural(unused, "it", "them")} if nothing else in the app uses ${plural(unused, "it", "them")}.`
        )
      }

      if (settings.base !== current.base) {
        print("Base UI and Radix components can take different props. Check the app's component code.")
      }
    })
})

export const main = defineCommand({
  meta: {
    name: "buildkit-shadcn",
    description: "Build the shadcn components into a @buildkitgg/shadcn package in this app"
  },
  subCommands: { sync: syncCommand, update: updateCommand, set: setCommand }
})

export function runCli() {
  return runMain(main)
}
