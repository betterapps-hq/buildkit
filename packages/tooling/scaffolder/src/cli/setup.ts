import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import type { CommandHint } from "../plan/types.js"
import type { SetupSettings } from "../state/settings.js"

/** Runs a setup command as its add-on wrote it, in a shell, in the project folder. */
export type SetupRunner = (command: string, cwd: string) => Promise<{ code: number; output: string }>

export const runSetupCommand: SetupRunner = (command, cwd) =>
  new Promise((settle, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()))
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()))
    child.on("error", reject)
    child.on("close", (code) => settle({ code: code ?? 1, output }))
  })

export interface SetupStep {
  label: string
  run: string
  /** Shown beside the label when the wizard offers it. */
  hint?: string
}

/** What a setup step that didn't run, or failed, leaves in the next steps. */
export function setupNextStep(step: SetupStep): string {
  return `${step.label}: ${step.run}`
}

const packageManagers = ["pnpm", "npm", "yarn", "bun"] as const

/** The package manager that ran the CLI, from `npm_config_user_agent`, such as `pnpm/10.0.0 npm/? node/v24.0.0`. */
export function packageManagerFrom(userAgent: string | undefined): SetupSettings["packageManager"] {
  const name = userAgent?.split("/")[0]

  return packageManagers.find((manager) => manager === name)
}

/**
 * The setup steps, in order: the `after-apply` setup commands, the install, the `after-install` setup commands, then a
 * git repository with a first commit. A setup command that's the install itself is the install step.
 */
export function setupSteps(
  commands: readonly CommandHint[],
  options: { settings?: SetupSettings; userAgent?: string; inRepository: boolean }
): SetupStep[] {
  const manager = options.settings?.packageManager ?? packageManagerFrom(options.userAgent) ?? "pnpm"
  const install = `${manager} install`

  const commandSteps = (when: CommandHint["when"]) =>
    commands.flatMap((command) =>
      command.setup && command.when === when && command.run !== install
        ? [{ label: command.why, run: command.run, hint: command.run }]
        : []
    )

  return [
    ...commandSteps("after-apply"),
    ...(options.settings?.install === false ? [] : [{ label: "Install dependencies", run: install, hint: install }]),
    ...commandSteps("after-install"),
    ...(options.settings?.git === false || options.inRepository
      ? []
      : [
          {
            label: "Create a git repository with a first commit",
            run: 'git init && git add -A && git commit -m "Initial commit"'
          }
        ])
  ]
}

/** The commands still worth listing once setup has its steps: the rest, without the install the setup offers. */
export function commandsBesideSetup(commands: readonly CommandHint[], steps: readonly SetupStep[]): CommandHint[] {
  return commands.filter((command) => !command.setup && !steps.some((step) => step.run === command.run))
}

/** Whether the folder is in a git repository already, as a project created inside a monorepo is. */
export function insideRepository(folder: string): boolean {
  for (let current = resolve(folder); ; current = dirname(current)) {
    if (existsSync(join(current, ".git"))) {
      return true
    }

    if (dirname(current) === current) {
      return false
    }
  }
}
