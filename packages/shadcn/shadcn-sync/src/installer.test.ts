import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import * as z from "zod"
import { SyncError } from "./errors.js"
import type { SyncResult, SyncStep } from "./sync.js"

// Every prompt answers from a queue, and every message lands in `shown`, so a test reads like the screens.
const answers: unknown[] = []
const shown: string[] = []
const cancel = Symbol("cancel")

vi.mock("@clack/prompts", () => ({
  isCancel: (value: string | boolean | symbol) => value === cancel,
  intro: (message: string) => shown.push(`intro ${message}`),
  outro: (message: string) => shown.push(`outro ${message}`),
  cancel: (message: string) => shown.push(`cancel ${message}`),
  note: (message: string, title: string) => shown.push(`note ${title}\n${message}`),
  log: {
    step: (message: string) => shown.push(`step ${message}`),
    message: (message: string) => shown.push(`message ${message}`),
    warn: (message: string) => shown.push(`warn ${message}`),
    error: (message: string) => shown.push(`error ${message}`)
  },
  spinner: () => ({
    start: (message: string) => shown.push(`spin ${message}`),
    stop: (message: string) => shown.push(`done ${message}`),
    error: (message: string) => shown.push(`failed ${message}`),
    clear: () => undefined
  }),
  select: async (options: {
    message: string
    options: { value: unknown; label: string }[]
    showInstructions?: boolean
  }) => {
    // clack's key hint separates its parts with a dot, which Buildkit's interface text never uses.
    if (options.showInstructions !== false) {
      throw new Error(`"${options.message}" shows clack's key hint`)
    }

    shown.push(`select ${options.message}\n${options.options.map((option) => option.label).join("\n")}`)

    const value = answers.shift()

    return value === cancel ? cancel : value
  },
  text: async (options: { message: string; validate: (value: string) => string | undefined }) => {
    const value = answers.shift()

    shown.push(`text ${options.message}`)

    const problem = value === cancel ? undefined : options.validate(String(value))

    if (problem) {
      shown.push(`invalid ${problem}`)
    }

    return value === cancel ? cancel : value
  }
}))

const ran: string[] = []

vi.mock("./spawn.js", () => ({
  run: async (command: string, args: readonly string[]) => {
    ran.push([command, ...args].join(" "))

    return { status: 0, output: "" }
  }
}))

const builds: unknown[] = []
const results: (SyncResult | Error)[] = []

vi.mock("./sync.js", () => ({
  sync: async (request: { progress?: (step: SyncStep) => void; settings: unknown; refresh?: boolean }) => {
    builds.push({ settings: request.settings, refresh: request.refresh ?? false })
    request.progress?.({ step: "catalog", mode: "replay" })
    request.progress?.({ step: "css" })

    const result = results.shift() ?? {
      built: true,
      snapshotWritten: false,
      dependencyAdded: false,
      linked: false,
      count: 63
    }

    if (result instanceof Error) {
      throw result
    }

    return result
  }
}))

vi.mock("./adapters.js", async (original) => ({
  ...(await original<typeof import("./adapters.js")>()),
  publishedAdapters: async () => [{ name: "@acme/shadcn-icons", description: "Acme icons" }]
}))

const { canAsk, changeList, previewUrl, runInstaller } = await import("./installer.js")
const { defaultSettings } = await import("./options.js")
const { addedSyncScript } = await import("./scripts.js")

// The temp app sits inside this package's node_modules, so it resolves the workspace's packages as an app would.
const app = resolve(import.meta.dirname, "../node_modules/.test-apps/installer")
const environment = { agent: process.env.npm_config_user_agent, event: process.env.npm_lifecycle_event }
const terminal = { stdin: process.stdin.isTTY, stdout: process.stdout.isTTY }

function writeApp(scripts: Record<string, string> = {}, dependencies: Record<string, string> = {}) {
  writeFileSync(
    join(app, "package.json"),
    JSON.stringify(
      { name: "app", scripts, dependencies, devDependencies: { "@buildkitgg/shadcn-sync": "workspace:*" } },
      null,
      2
    ) + "\n"
  )
}

function manifest() {
  return z
    .object({ scripts: z.record(z.string(), z.string()).optional() })
    .parse(JSON.parse(readFileSync(join(app, "package.json"), "utf8")))
}

function screens() {
  return shown.join("\n")
}

function setTerminal(on: boolean) {
  process.stdin.isTTY = on
  process.stdout.isTTY = on
}

beforeEach(() => {
  answers.length = 0
  shown.length = 0
  ran.length = 0
  builds.length = 0
  results.length = 0
  rmSync(app, { recursive: true, force: true })
  mkdirSync(app, { recursive: true })
  writeApp()
  process.env.npm_config_user_agent = "pnpm/12.10.1 npm/? node/v24"
  delete process.env.npm_lifecycle_event
  delete process.env.CI
  process.exitCode = 0
  setTerminal(true)
})

afterAll(() => {
  setTerminal(false)
  process.stdin.isTTY = terminal.stdin
  process.stdout.isTTY = terminal.stdout
  process.env.npm_config_user_agent = environment.agent
  process.exitCode = 0

  if (environment.event !== undefined) {
    process.env.npm_lifecycle_event = environment.event
  }

  rmSync(app, { recursive: true, force: true })
})

describe("when the installer asks", () => {
  it("asks only at a terminal, outside CI and outside an install", () => {
    expect(canAsk()).toBe(true)

    process.env.npm_lifecycle_event = "postinstall"
    expect(canAsk()).toBe(false)

    delete process.env.npm_lifecycle_event
    process.env.CI = "true"
    expect(canAsk()).toBe(false)

    delete process.env.CI
    setTerminal(false)
    expect(canAsk()).toBe(false)
  })
})

describe("the installer's first run", () => {
  it("asks each setting, builds, and writes the postinstall", async () => {
    answers.push("base", "vega", "zinc", "lucide")
    results.push({ built: true, snapshotWritten: true, dependencyAdded: true, linked: true, count: 63 })

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain(
      "select Which primitives should the components use?\nBase UI (Recommended)\nRadix\nReact Aria"
    )
    expect(screens()).toContain("Preview the styles at")
    expect(screens()).toContain("select Which style?\nNova\nVega")
    expect(screens()).toContain("@acme/shadcn-icons")
    expect(screens()).toContain("spin Installing components from the snapshot")
    expect(screens()).toContain("done Compiled CSS")
    expect(screens()).toContain("step Built 63 components")
    expect(screens()).toContain("step Linked @buildkitgg/shadcn")
    expect(screens()).toContain(
      'package.json           "postinstall" script\n                       @buildkitgg/shadcn'
    )
    expect(screens()).toContain("create?preset=bJLYpge&base=base")
    expect(screens()).toContain("outro Done. Commit package.json and shadcn-registry.json.")
    expect(manifest().scripts?.postinstall).toBe(
      "shadcn-sync sync --base base --icons lucide --style vega --theme zinc"
    )
  })

  it("skips the questions a flag answers", async () => {
    answers.push("lucide")

    await runInstaller({
      appDirectory: app,
      flags: { base: "base", style: "nova", theme: "neutral" },
      yes: false,
      verbose: false
    })

    expect(screens()).not.toContain("Which style?")
    expect(screens()).not.toContain("Preview the styles")
    expect(screens()).toContain("select Which icons?")
  })

  it("installs the packages a choice needs after asking", async () => {
    answers.push("base", "nova", "neutral", "phosphor", true)

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain("select Install the packages these settings need?")
    expect(screens()).toContain("pnpm add @phosphor-icons/react")
    expect(ran).toEqual(["pnpm add @phosphor-icons/react"])
    expect(screens()).toContain("done Installed 1 package")
  })

  it("stops with nothing changed when the person would rather install", async () => {
    answers.push("base", "nova", "neutral", "phosphor", false)

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(ran).toEqual([])
    expect(builds).toEqual([])
    expect(screens()).toContain("outro Nothing changed. Install the packages, then run shadcn-sync again.")
    expect(manifest().scripts).toEqual({})
  })

  it("offers what a build finds missing, then builds again", async () => {
    answers.push("base", "nova", "neutral", "lucide", true)
    results.push(new SyncError("dependency", "vaul isn't installed.", true, ["vaul"]))

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain("done The components also use vaul")
    expect(ran).toEqual(["pnpm add vaul"])
    expect(builds).toHaveLength(2)
    expect(screens()).toContain("outro Done.")
  })

  it("takes another adapter by name", async () => {
    answers.push("base", "nova", "neutral", "\0another", "Not A Package")

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain("text Which icon adapter package?")
    expect(screens()).toContain("invalid --icons Not A Package isn't an icon library id or a package name.")
    expect(screens()).toContain("error --icons Not A Package isn't an icon library id or a package name.")
    expect(process.exitCode).toBe(1)
  })

  it("ends a canceled question with nothing changed", async () => {
    answers.push(cancel)

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain("cancel Canceled. Nothing changed.")
    expect(manifest().scripts).toEqual({})
  })

  it("shows a failed build inside the frame", async () => {
    answers.push("base", "nova", "neutral", "lucide")
    results.push(new SyncError("compilation", "The components don't type-check.", true))

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain("failed Compiling CSS failed")
    expect(screens()).toContain("error The components don't type-check.")
    expect(screens()).toContain("outro Previous output kept.")
    expect(process.exitCode).toBe(1)
    expect(manifest().scripts).toEqual({})
  })
})

describe("the installer in a set-up app", () => {
  const command = "shadcn-sync sync --base base --icons lucide --style nova --theme neutral"

  it("rebuilds with the current settings", async () => {
    writeApp({ postinstall: command })
    answers.push("rebuild")

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain(
      "note Current settings\nPrimitives  Base UI\nStyle       Nova\nTheme       Neutral\nIcons       Lucide"
    )
    expect(screens()).not.toContain("note Changed")
    expect(screens()).toContain("outro Done. Nothing to commit.")
  })

  it("shows each change and asks before applying it", async () => {
    writeApp({ postinstall: command })
    answers.push("change", "aria", "nova", "neutral", "lucide", true, true)

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain("select Apply these changes?")
    expect(screens()).toContain("Primitives  Base UI → React Aria")
    expect(screens()).toContain("pnpm add react-aria-components")
    expect(screens()).toContain("warn Base UI and React Aria components take different props.")
    expect(manifest().scripts?.postinstall).toBe(command.replace("--base base", "--base aria"))
  })

  it("leaves everything alone when the changes are declined or match", async () => {
    writeApp({ postinstall: command })
    answers.push("change", "base", "nova", "neutral", "lucide")

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain("outro Those are the current settings. Nothing changed.")

    shown.length = 0
    answers.push("change", "base", "vega", "neutral", "lucide", false)

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain("outro Nothing changed.")
    expect(builds).toEqual([])
    expect(manifest().scripts?.postinstall).toBe(command)
  })

  it("goes straight to the questions for set", async () => {
    writeApp({ postinstall: command })
    answers.push("base", "nova", "neutral", "@acme/shadcn-icons", true)

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false, change: true })

    expect(screens()).not.toContain("What do you want to do?")
    expect(screens()).toContain("Icons       Lucide → @acme/shadcn-icons")
    expect(screens()).toContain("pnpm add -D @acme/shadcn-icons")
  })

  it("gets the latest components and lists what changed", async () => {
    writeApp({ postinstall: command })
    answers.push("update")
    results.push({
      built: true,
      snapshotWritten: true,
      dependencyAdded: false,
      linked: false,
      count: 64,
      changes: { added: ["styles/base-nova/kbd.json"], removed: [], changed: [] }
    })

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(builds).toEqual([{ settings: defaultSettings, refresh: true }])
    expect(screens()).toContain("note What changed\nAdded     kbd")
    expect(screens()).toContain("outro Done. Commit shadcn-registry.json.")

    shown.length = 0
    answers.push("update")
    results.push({
      built: true,
      snapshotWritten: false,
      dependencyAdded: false,
      linked: false,
      count: 64,
      changes: { added: [], removed: [], changed: [] }
    })

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain("outro You already have the latest components.")
  })

  it("shows a failed update inside the frame", async () => {
    writeApp({ postinstall: command })
    answers.push("update")
    results.push(new SyncError("registry", "Can't reach the registry.", true))

    await runInstaller({ appDirectory: app, flags: {}, yes: false, verbose: false })

    expect(screens()).toContain("failed Compiling CSS failed")
    expect(process.exitCode).toBe(1)
  })
})

describe("the installer without questions", () => {
  it("fails with the install command when packages are missing", async () => {
    setTerminal(false)

    await expect(
      runInstaller({ appDirectory: app, flags: { icons: "phosphor" }, yes: false, verbose: false })
    ).rejects.toThrow(
      "@phosphor-icons/react isn't installed. Install it, then run this command again:\n  pnpm add @phosphor-icons/react"
    )
  })

  it("installs what's missing with --yes and prints plain lines", async () => {
    const logs: string[] = []
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => logs.push(String(chunk)) > 0)

    results.push({ built: true, snapshotWritten: true, dependencyAdded: true, linked: true, count: 63 })

    try {
      await runInstaller({ appDirectory: app, flags: { icons: "phosphor" }, yes: true, verbose: false })
    } finally {
      stdout.mockRestore()
    }

    expect(ran).toEqual(["pnpm add @phosphor-icons/react"])
    expect(logs.join("")).toContain(
      'shadcn-sync: updated the "postinstall" script. Commit package.json and shadcn-registry.json.'
    )
    expect(logs.join("")).toContain("shadcn-sync: added @buildkitgg/shadcn to package.json.")
    expect(shown).toEqual([])
  })
})

describe("installer helpers", () => {
  it("links to shadcn's theme builder with the same choices", () => {
    expect(previewUrl(defaultSettings)).toBe("https://ui.shadcn.com/create?preset=b0&base=base")
    expect(previewUrl({ ...defaultSettings, base: "radix", style: "vega", theme: "zinc", icons: "phosphor" })).toBe(
      "https://ui.shadcn.com/create?preset=bJLZepk&base=radix"
    )
    expect(previewUrl({ ...defaultSettings, icons: "@buildkitgg/shadcn-icons-fluent" })).toBe(
      "https://ui.shadcn.com/create?preset=b0&base=base"
    )
  })

  it("lists an update's changes by component name", () => {
    const changes = {
      added: ["styles/base-nova/kbd.json"],
      removed: ["styles/base-nova/old.json"],
      changed: ["styles/base-nova/button.json", "styles/base-nova/dialog.json"]
    }

    expect(changeList({ built: true, snapshotWritten: true, dependencyAdded: false, linked: false, changes })).toBe(
      "Added     kbd\nRemoved   old\nChanged   button, dialog"
    )
    expect(changeList({ built: true, snapshotWritten: false, dependencyAdded: false, linked: false })).toBeUndefined()
  })

  it("adds sync to the postinstall, after what it already runs", () => {
    const settings = { ...defaultSettings, style: "vega" }

    expect(addedSyncScript(app, settings)).toEqual({
      name: "postinstall",
      command: "shadcn-sync sync --base base --icons lucide --style vega --theme neutral"
    })

    writeApp({ postinstall: "patch-package" })

    expect(addedSyncScript(app, settings).command).toBe(
      "patch-package && shadcn-sync sync --base base --icons lucide --style vega --theme neutral"
    )
  })
})
