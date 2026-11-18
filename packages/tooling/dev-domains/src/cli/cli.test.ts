import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import * as prompts from "@clack/prompts"
import { runCommand } from "citty"
import { afterEach, expect, it, vi } from "vite-plus/test"
import { runEndpoint } from "../runtime/portless.js"
import { cli, commands } from "./commands.js"
import { initialize } from "./init.js"
import { answer, chooseEndpoint } from "./terminal.js"

vi.mock("../runtime/portless.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../runtime/portless.js")>()),
  runEndpoint: vi.fn<typeof runEndpoint>(async () => 0)
}))

vi.mock("@clack/prompts", () => ({
  intro: vi.fn<typeof prompts.intro>(),
  outro: vi.fn<typeof prompts.outro>(),
  note: vi.fn<typeof prompts.note>(),
  text: vi.fn<typeof prompts.text>(),
  select: vi.fn<typeof prompts.select>(),
  multiselect: vi.fn<typeof prompts.select>(),
  confirm: vi.fn<typeof prompts.confirm>()
}))

Object.defineProperty(process.stdin, "isTTY", { configurable: true, get: () => false })

const dirs: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "buildkit-cli-"))
  dirs.push(root)
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "demo", scripts: { dev: "vite", storybook: "storybook dev" } })
  )

  return root
}

it("prints detection, resolved URLs, and schema without writing config", async () => {
  const root = await fixture()
  const write = vi.spyOn(process.stdout, "write").mockReturnValue(true)
  await runCommand(commands.detect, { rawArgs: ["--cwd", root] })
  await runCommand(commands.urls, { rawArgs: ["--cwd", root] })
  await runCommand(commands.schema, { rawArgs: [] })
  expect(write.mock.calls.map(([value]) => String(value)).join("\n")).toContain("https://demo.localhost")
  await expect(readFile(path.join(root, "dev-domains.json"))).rejects.toThrow(Error)
})

it("runs the default command with a separate --cwd value", async () => {
  const root = await fixture()
  const web = path.join(root, "apps", "web")
  await mkdir(web, { recursive: true })
  await writeFile(path.join(web, "package.json"), JSON.stringify({ name: "web", scripts: { dev: "vite" } }))
  const write = vi.spyOn(process.stdout, "write").mockReturnValue(true)
  const start = process.cwd()
  process.chdir(root)

  try {
    await runCommand(cli, { rawArgs: ["--cwd", "apps/web"] })
  } finally {
    process.chdir(start)
  }

  expect(process.exitCode).toBe(0)
  process.exitCode = undefined
  expect(write).toHaveBeenCalledWith("app: https://web.localhost\n")
  expect(runEndpoint).toHaveBeenCalledWith(
    expect.objectContaining({ root: await realpath(web) }),
    expect.objectContaining({ service: "app" }),
    expect.any(AbortSignal)
  )
})

it("supports noninteractive dry runs and refuses overwrite", async () => {
  const root = await fixture()
  vi.spyOn(process.stdout, "write").mockReturnValue(true)
  await initialize(root, { yes: true, dryRun: true, domain: "local.example.com" })
  await expect(readFile(path.join(root, "dev-domains.json"))).rejects.toThrow(Error)
  await initialize(root, { yes: true })
  expect(JSON.parse(await readFile(path.join(root, "dev-domains.json"), "utf8"))).toMatchObject({ project: "demo" })
  await expect(initialize(root, { yes: true })).rejects.toThrow("already exists")
})

it("guides selection, naming, callbacks, tests, and webhook configuration", async () => {
  const root = await fixture()
  vi.spyOn(process.stdin, "isTTY", "get").mockReturnValue(true)
  vi.mocked(prompts.text)
    .mockResolvedValueOnce("demo")
    .mockResolvedValueOnce("local.example.com")
    .mockResolvedValueOnce("{project}")
    .mockResolvedValueOnce("{project}-{worktree}")
    .mockResolvedValueOnce("/callback")
    .mockResolvedValueOnce('["tunnel", "{url}"]')
    .mockResolvedValueOnce("/hooks")
  vi.mocked(prompts.multiselect).mockResolvedValueOnce(["app"]).mockResolvedValueOnce(["auth", "e2e", "webhooks"])
  vi.mocked(prompts.confirm).mockResolvedValue(true)
  await initialize(root, {})
  const config = JSON.parse(await readFile(path.join(root, "dev-domains.json"), "utf8"))
  expect(config.endpoints.app).toMatchObject({ auth: ["/callback"], tunnel: { paths: ["/hooks"] } })
  expect(config.endpoints["app-e2e"]).toMatchObject({ kind: "e2e", script: "dev" })
})

it("handles cancellation and endpoint selection without implicit choices", async () => {
  expect(() => answer(Symbol("cancel"))).toThrow("cancelled")
  expect(await chooseEndpoint([{ service: "app", origin: "http://app" }])).toBe("app")
  await expect(chooseEndpoint([], "missing")).rejects.toThrow("Unknown endpoint")
  const tty = vi.spyOn(process.stdin, "isTTY", "get").mockReturnValue(false)
  await expect(
    chooseEndpoint([
      { service: "a", origin: "http://a" },
      { service: "b", origin: "http://b" }
    ])
  ).rejects.toThrow("Specify")
  const root = await fixture()
  await expect(initialize(root, {})).rejects.toThrow("needs a terminal")
  tty.mockReturnValue(true)
  vi.mocked(prompts.select).mockResolvedValue("a")
  expect(
    await chooseEndpoint([
      { service: "a", origin: "http://a" },
      { service: "b", origin: "http://b" }
    ])
  ).toBe("a")
})

it("offers detected E2E servers unchecked and saves them only when selected", async () => {
  const root = await fixture()
  await writeFile(path.join(root, "playwright.config.ts"), 'throw new Error("must not load")')
  vi.spyOn(process.stdin, "isTTY", "get").mockReturnValue(true)
  vi.mocked(prompts.text).mockImplementation(async (options) => options.defaultValue || "")
  vi.mocked(prompts.multiselect).mockResolvedValueOnce(["app", "app-e2e"]).mockResolvedValueOnce([])
  vi.mocked(prompts.confirm).mockResolvedValue(true)
  await initialize(root, {})
  expect(prompts.multiselect).toHaveBeenNthCalledWith(1, expect.objectContaining({ initialValues: ["app", "stories"] }))
  const saved = JSON.parse(await readFile(path.join(root, "dev-domains.json"), "utf8"))
  expect(saved.endpoints["app-e2e"]).toMatchObject({ kind: "e2e", script: "dev" })
  expect(Object.keys(saved.endpoints)).toEqual(["app", "app-e2e"])
  expect(saved.endpoints["app-e2e"].env).toBeUndefined()
})

it("keeps a manually entered command when adding a dedicated test server", async () => {
  const root = await fixture()
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "demo" }))
  vi.spyOn(process.stdin, "isTTY", "get").mockReturnValue(true)
  vi.mocked(prompts.text).mockImplementation(async (options) => options.defaultValue || "")
  vi.mocked(prompts.multiselect).mockResolvedValueOnce(["e2e"])
  vi.mocked(prompts.confirm).mockResolvedValue(true)
  await initialize(root, {})
  const saved = JSON.parse(await readFile(path.join(root, "dev-domains.json"), "utf8"))
  expect(saved.endpoints["app-e2e"]).toMatchObject({ kind: "e2e", command: ["node", "server.js"] })
  expect(saved.endpoints["app-e2e"].script).toBeUndefined()
})

it("keeps init --yes limited to ordinary servers when Playwright is detected", async () => {
  const root = await fixture()
  await writeFile(path.join(root, "playwright.config.ts"), "export default {}")
  vi.spyOn(process.stdout, "write").mockReturnValue(true)
  await initialize(root, { yes: true })
  const saved = JSON.parse(await readFile(path.join(root, "dev-domains.json"), "utf8"))
  expect(Object.keys(saved.endpoints)).toEqual(["app", "stories"])
})
