import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { runCommand } from "citty"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { main } from "./cli.js"
import { outputFolder } from "./register.js"

// The temp app sits inside this package's node_modules, so it resolves the components' dependencies from the
// workspace the way an app resolves them from its own install.
const packageRoot = resolve(import.meta.dirname, "..")
const app = join(packageRoot, "node_modules/.test-apps/app")
const output = join(app, outputFolder)
const snapshot = resolve(packageRoot, "../../../apps/shadcn-sync-example/shadcn-registry.json")
const environment = { CI: process.env.CI, agent: process.env.npm_config_user_agent }
const startDirectory = process.cwd()

function read(path: string) {
  return readFileSync(join(app, path), "utf8")
}

function writeManifest(scripts: Record<string, string>, dependencies: Record<string, string> = {}) {
  writeFileSync(
    join(app, "package.json"),
    JSON.stringify(
      {
        name: "test-app",
        private: true,
        scripts,
        dependencies,
        devDependencies: { "@buildkitgg/shadcn-sync": "workspace:*" }
      },
      null,
      2
    ) + "\n"
  )
}

async function cli(...rawArgs: string[]) {
  const errors: string[] = []
  const logs: string[] = []
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => errors.push(String(chunk)) > 0)
  const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => logs.push(String(chunk)) > 0)

  process.exitCode = 0

  try {
    await runCommand(main, { rawArgs })
  } finally {
    stderr.mockRestore()
    stdout.mockRestore()
  }

  const failed = process.exitCode === 1

  process.exitCode = 0

  return { failed, errors: errors.join(""), logs: logs.join("") }
}

beforeAll(() => {
  rmSync(app, { recursive: true, force: true })
  mkdirSync(app, { recursive: true })
  copyFileSync(snapshot, join(app, "shadcn-registry.json"))
  writeManifest({ postinstall: "shadcn-sync sync --icons lucide" })
  delete process.env.CI
  process.env.npm_config_user_agent = "pnpm/12.10.1 npm/? node/v24"
  process.chdir(app)
})

beforeEach(() => {
  delete process.env.CI
})

afterAll(() => {
  process.chdir(startDirectory)
  process.env.npm_config_user_agent = environment.agent

  if (environment.CI !== undefined) {
    process.env.CI = environment.CI
  }

  rmSync(app, { recursive: true, force: true })
})

describe("shadcn-sync", () => {
  it("builds the package from the snapshot, registers it and links it", async () => {
    const result = await cli("sync", "--icons", "lucide")

    expect(result.errors).toBe("")
    expect(result.logs).toContain("built 63 components")
    expect(result.logs).toContain("added @buildkitgg/shadcn to package.json")
    expect(JSON.parse(read("package.json")).dependencies).toEqual({ "@buildkitgg/shadcn": `link:${outputFolder}` })
    expect(realpathSync(join(app, "node_modules/@buildkitgg/shadcn"))).toBe(realpathSync(output))

    const manifest = JSON.parse(read(`${outputFolder}/package.json`))

    expect(manifest.name).toBe("@buildkitgg/shadcn")
    expect(manifest.exports["./button"]).toEqual({
      types: "./components/button/index.d.ts",
      import: "./components/button/index.js"
    })
    expect(manifest.peerDependencies["lucide-react"]).toBeDefined()
    expect(read(`${outputFolder}/components/button/index.js`)).toContain('from "../../ui/button.js"')
    expect(read(`${outputFolder}/ui/button.js`)).toContain('import "../components/button/styles.css"')
    expect(read(`${outputFolder}/ui/dialog.js`).startsWith('"use client"')).toBe(true)
    expect(read(`${outputFolder}/components/button/styles.css`)).toContain("@layer utilities.u")
  })

  it("skips a current output and restores a deleted file", async () => {
    expect((await cli("sync", "--icons", "lucide")).logs).toBe("")

    rmSync(join(output, "ui/button.js"))

    expect((await cli("sync", "--icons", "lucide")).logs).toContain("built 63 components")
    expect(existsSync(join(output, "ui/button.js"))).toBe(true)
  })

  it("swaps icons through an adapter with set, from the same snapshot", async () => {
    const before = read("shadcn-registry.json")
    const result = await cli("set", "--icons", "@buildkitgg/shadcn-icons-fluent")

    expect(result.errors).toBe("")
    expect(result.logs).toContain('updated the "postinstall" script')
    expect(result.logs).toContain("no longer use lucide-react")
    expect(JSON.parse(read("package.json")).scripts.postinstall).toBe(
      "shadcn-sync sync --icons @buildkitgg/shadcn-icons-fluent"
    )
    expect(read(`${outputFolder}/ui/dialog.js`)).toContain("@fluentui/react-icons/headless/svg/dismiss")
    expect(read(`${outputFolder}/shared.css`)).toContain(
      '@import "@fluentui/react-icons/headless/styles.css" layer(base);'
    )
    expect(read("shadcn-registry.json")).toBe(before)
  })

  it("runs the installer without questions outside a terminal, keeping the current settings", async () => {
    const result = await cli()

    expect(result.errors).toBe("")
    expect(result.logs).toContain("built 63 components (Base UI, nova, neutral, @buildkitgg/shadcn-icons-fluent icons)")
    expect(result.logs).not.toContain("updated the")
  })

  it("stops on icons an adapter doesn't map and keeps the previous output", async () => {
    const adapter = join(app, "node_modules/partial-icons")

    mkdirSync(adapter, { recursive: true })
    writeFileSync(
      join(adapter, "package.json"),
      JSON.stringify({ name: "partial-icons", version: "1.0.0", type: "module", exports: "./index.js" })
    )
    writeFileSync(
      join(adapter, "index.js"),
      'export default { package: "lucide-react", icons: { XIcon: { name: "X", module: "lucide-react" } } }\n'
    )

    const result = await cli("sync", "--icons", "partial-icons")

    expect(result.failed).toBe(true)
    expect(result.errors).toContain('"partial-icons" can\'t map these icons:')
    expect(result.errors).toContain("ChevronDownIcon, used in select")
    expect(result.errors).toContain("Previous output kept.")
    expect(read(`${outputFolder}/ui/dialog.js`)).toContain("@fluentui/react-icons")

    const broken = join(app, "node_modules/broken-icons")

    mkdirSync(broken, { recursive: true })
    writeFileSync(
      join(broken, "package.json"),
      JSON.stringify({ name: "broken-icons", type: "module", main: "index.js" })
    )
    writeFileSync(join(broken, "index.js"), "export default { icons: {} }\n")

    expect((await cli("sync", "--icons", "broken-icons")).errors).toContain("broken-icons isn't an icon adapter")
    expect((await cli("sync", "--icons", "missing-icons")).errors).toContain(
      "missing-icons isn't installed. Add it to this app's devDependencies"
    )
  })

  it("prints the install command when set needs a package the app doesn't have", async () => {
    const result = await cli("set", "--icons", "phosphor")

    expect(result.failed).toBe(true)
    expect(result.errors).toContain("@phosphor-icons/react isn't installed.")
    expect(result.errors).toContain("pnpm add @phosphor-icons/react")
  })

  it("refuses a hand-edited snapshot", async () => {
    const original = read("shadcn-registry.json")

    writeFileSync(join(app, "shadcn-registry.json"), original.replace('"oklch(1 0 0)"', '"oklch(0.9 0 0)"'))

    const result = await cli("sync")

    writeFileSync(join(app, "shadcn-registry.json"), original)
    expect(result.errors).toContain("shadcn-registry.json was edited by hand.")
  })

  it("fails in CI instead of fetching or editing package.json", async () => {
    process.env.CI = "true"

    expect((await cli("sync", "--style", "vega")).errors).toContain(
      "shadcn-registry.json is missing or doesn't match --base base, --style vega and --theme neutral, and CI is set."
    )

    writeManifest({ postinstall: "shadcn-sync sync" })

    expect((await cli("sync")).errors).toContain("@buildkitgg/shadcn is missing from package.json, and CI is set.")
  })

  it("explains a missing sync script and a bad flag", async () => {
    writeManifest({ build: "vite build" }, { "@buildkitgg/shadcn": `link:${outputFolder}` })

    expect((await cli("update")).errors).toContain("no script that runs shadcn-sync sync")
    expect((await cli("sync", "--base", "mui")).errors).toContain("--base mui isn't valid. Use radix, base, or aria.")
  })
})
