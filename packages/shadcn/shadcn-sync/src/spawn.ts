import { spawn } from "node:child_process"

/** How a child process ended, with everything it printed. */
export interface Finished {
  readonly status: number | null
  readonly output: string
}

interface SpawnOptions {
  readonly cwd: string
  readonly env?: NodeJS.ProcessEnv
}

/**
 * Runs a command without blocking the event loop, so a spinner keeps turning, and collects its output. Windows runs
 * package manager shims (`pnpm.cmd`) only through a shell; the arguments are package names and flags sync checked.
 */
export function run(command: string, args: readonly string[], options: SpawnOptions): Promise<Finished> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: process.platform === "win32" && command !== process.execPath,
      stdio: ["ignore", "pipe", "pipe"]
    })

    let output = ""

    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk
    })
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk
    })
    child.on("error", reject)
    child.on("close", (status) => resolve({ status, output }))
  })
}
