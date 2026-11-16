import { defineCommand, runMain } from "citty"
import pc from "picocolors"
import { SyncError } from "./errors.js"
import { canAsk, changeList, print, runInstaller, skipVariable } from "./installer.js"
import { hasSettingFlags, parseSettings } from "./options.js"
import { dependencyAddedMessage } from "./register.js"
import { findSyncScript, findSyncScriptIfAny, scriptFlags } from "./scripts.js"
import { snapshotFile } from "./snapshot.js"
import { sync, type SyncResult } from "./sync.js"

const settingArgs = {
  base: { type: "string", description: "Primitives: base, radix or aria", valueHint: "base" },
  icons: { type: "string", description: "Icon library id, or an icon adapter's package name", valueHint: "library" },
  style: { type: "string", description: "shadcn style, such as nova or vega", valueHint: "style" },
  theme: { type: "string", description: "shadcn color theme, such as neutral", valueHint: "theme" },
  css: {
    type: "string",
    description: "CSS mode: compiled, or tailwind for an app that runs Tailwind v4",
    valueHint: "mode"
  }
} as const

const verboseArg = { verbose: { type: "boolean", description: "Log each stage", default: false } } as const

const yesArg = {
  yes: {
    type: "boolean",
    alias: "y",
    description: "Don't ask: use the current settings or the defaults, and install what's missing",
    default: false
  }
} as const

function report(result: SyncResult) {
  if (result.snapshotWritten) {
    print(`wrote ${snapshotFile}. Commit it with the app.`)
  }

  if (result.dependencyAdded) {
    print(dependencyAddedMessage())
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
      `${pc.red("shadcn-sync:")} ${error.message}${error.previousKept ? " Previous output kept." : ""}\n${pc.dim(`Failed at the ${error.stage} stage.`)}\n`
    )
    process.exitCode = 1
  }
}

const syncCommand = defineCommand({
  meta: {
    name: "sync",
    description: "Build @buildkitgg/shadcn from shadcn-registry.json. In a terminal with no settings yet, asks for them"
  },
  args: {
    ...settingArgs,
    force: { type: "boolean", description: "Rebuild even when the output is current", default: false },
    ...verboseArg
  },
  run: ({ args }) =>
    run(async () => {
      // The installer is installing packages and builds once they're in.
      if (process.env[skipVariable]) {
        return
      }

      const appDirectory = process.cwd()

      if (canAsk() && !hasSettingFlags(args) && !findSyncScriptIfAny(appDirectory)) {
        await runInstaller({ appDirectory, flags: {}, yes: false, verbose: args.verbose })

        return
      }

      report(await sync({ appDirectory, settings: parseSettings(args), force: args.force, verbose: args.verbose }))
    })
})

const updateCommand = defineCommand({
  meta: { name: "update", description: "Get the latest components from shadcn, record a new snapshot, and rebuild" },
  args: verboseArg,
  run: ({ args }) =>
    run(async () => {
      const appDirectory = process.cwd()
      const settings = parseSettings(scriptFlags(findSyncScript(appDirectory).command))
      const result = await sync({ appDirectory, settings, refresh: true, force: true, verbose: args.verbose })

      const changes = changeList(result)

      if (changes) {
        process.stdout.write(`${changes}\n`)
      } else {
        print("you already have the latest components.")
      }

      report(result)
    })
})

const setCommand = defineCommand({
  meta: {
    name: "set",
    description: "Change settings, rebuild, and update the sync script. With no options, asks for each setting"
  },
  args: { ...settingArgs, ...yesArg, ...verboseArg },
  run: ({ args }) =>
    run(async () => {
      const appDirectory = process.cwd()

      // Fails early, with what to add, when no script runs sync yet.
      findSyncScript(appDirectory)
      await runInstaller({ appDirectory, flags: args, yes: args.yes, verbose: args.verbose, change: true })
    })
})

export const main = defineCommand({
  meta: {
    name: "shadcn-sync",
    description:
      "Build the shadcn components into a @buildkitgg/shadcn package in this app. With no command, asks what to build"
  },
  args: { ...settingArgs, ...yesArg, ...verboseArg },
  subCommands: { sync: syncCommand, update: updateCommand, set: setCommand },
  run: ({ args }) =>
    run(async () => {
      // citty runs the root command after a subcommand too; the subcommand, named first, already did the work.
      if (args._.length > 0) {
        return
      }

      await runInstaller({ appDirectory: process.cwd(), flags: args, yes: args.yes, verbose: args.verbose })
    })
})

export function runCli() {
  return runMain(main)
}
