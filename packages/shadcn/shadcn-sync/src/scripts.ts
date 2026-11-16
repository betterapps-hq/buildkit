import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as z from "zod"
import { SyncError } from "./errors.js"
import { defaultSettings, settingKeys, type SettingFlags, type SyncSettings } from "./options.js"
import { readPackageJson } from "./register.js"

const syncCall = /\bshadcn-sync\s+sync\b[^&|;]*/

const manifestSchema = z.looseObject({ scripts: z.record(z.string(), z.string()).optional() })

/** The app's script that runs `shadcn-sync sync`: the `postinstall`, or another script when the app runs it by hand. */
export interface SyncScript {
  readonly name: string
  readonly command: string
}

function readScripts(appDirectory: string) {
  return manifestSchema.parse(JSON.parse(readFileSync(join(appDirectory, "package.json"), "utf8"))).scripts ?? {}
}

/** The app's sync script, or `undefined` when no script runs sync yet. */
export function findSyncScriptIfAny(appDirectory: string): SyncScript | undefined {
  const scripts = readScripts(appDirectory)
  const names = ["postinstall", ...Object.keys(scripts).filter((name) => name !== "postinstall")]
  const name = names.find((entry) => syncCall.test(scripts[entry] ?? ""))

  return name ? { name, command: scripts[name] ?? "" } : undefined
}

export function findSyncScript(appDirectory: string): SyncScript {
  const script = findSyncScriptIfAny(appDirectory)

  if (!script) {
    throw new SyncError(
      "configuration",
      'package.json has no script that runs shadcn-sync sync. Add it to "postinstall", then run this command again.'
    )
  }

  return script
}

/**
 * The `postinstall` that runs sync with the settings, after whatever the app's `postinstall` already runs. Spells out
 * the main settings so the app's choices read at a glance.
 */
export function addedSyncScript(appDirectory: string, settings: SyncSettings): SyncScript {
  const existing = readScripts(appDirectory).postinstall?.trim()
  const flags = (["base", "icons", "style", "theme"] as const).map((key) => `--${key} ${settings[key]}`)

  const call = [
    "shadcn-sync sync",
    ...flags,
    ...(settings.css === defaultSettings.css ? [] : [`--css ${settings.css}`])
  ]

  return { name: "postinstall", command: existing ? `${existing} && ${call.join(" ")}` : call.join(" ") }
}

/** Reads the setting flags from the script's `shadcn-sync sync` call. */
export function scriptFlags(command: string): SettingFlags {
  const words = (syncCall.exec(command)?.[0] ?? "").trim().split(/\s+/)
  const flags: Partial<Record<(typeof settingKeys)[number], string>> = {}

  for (const [index, word] of words.entries()) {
    const match = /^--(base|icons|style|theme|css)(?:=(.+))?$/.exec(word)
    const key = settingKeys.find((entry) => entry === match?.[1])

    if (key) {
      flags[key] = match?.[2] ?? words[index + 1] ?? ""
    }
  }

  return flags
}

/**
 * The command with every setting flag in its sync call set to the new value. A flag it didn't have is added unless the
 * new value is the default.
 */
export function withSettings(command: string, settings: SyncSettings): string {
  return command.replace(syncCall, (call) => {
    let next = call.trimEnd()
    const trailing = call.slice(next.length)

    for (const key of settingKeys) {
      const pattern = new RegExp(`--${key}(=|\\s+)\\S+`)

      if (pattern.test(next)) {
        next = next.replace(pattern, `--${key}$1${settings[key]}`)
      } else if (settings[key] !== defaultSettings[key]) {
        next = `${next} --${key} ${settings[key]}`
      }
    }

    return `${next}${trailing}`
  })
}

/** Rewrites one script in `package.json`, keeping the file's indentation and final newline. */
export function writeScript(appDirectory: string, name: string, command: string) {
  const { indent, newline, value } = readPackageJson(appDirectory)
  const scripts = { ...z.record(z.string(), z.string()).optional().parse(value.scripts), [name]: command }

  writeFileSync(
    join(appDirectory, "package.json"),
    JSON.stringify({ ...value, scripts }, null, indent) + (newline ? "\n" : "")
  )
}
