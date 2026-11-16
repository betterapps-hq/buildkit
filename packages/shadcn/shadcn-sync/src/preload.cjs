// @ts-check
// Loaded into the shadcn CLI with --require. It records the CLI's registry responses, or replays them from the
// snapshot with every other request blocked, and turns the package-manager install that `shadcn add` starts into a
// no-op. Sync reads what happened from the event log once the CLI exits. It knows nothing about which URLs the CLI
// asks for, so a CLI release that fetches something new keeps working after the next update. It's plain CommonJS so
// Node can preload it from the source folder and from the build alike.
const childProcess = require("node:child_process")
const fs = require("node:fs")
const http = require("node:http")
const https = require("node:https")

const mode = process.env.BUILDKIT_SHADCN_MODE
const registry = process.env.BUILDKIT_SHADCN_REGISTRY ?? ""
const eventLog = process.env.BUILDKIT_SHADCN_EVENTS ?? ""
const snapshotPath = process.env.BUILDKIT_SHADCN_RESPONSES

/**
 * @typedef {{ type: "record", path: string, body: string }
 *   | { type: "miss", path: string }
 *   | { type: "failed", path: string, status: number }
 *   | { type: "blocked", url: string }
 *   | { type: "install", command: string }} PreloadEvent
 */

/** @param {PreloadEvent} event */
function emit(event) {
  fs.appendFileSync(eventLog, JSON.stringify(event) + "\n")
}

/**
 * @param {string} url
 * @returns {never}
 */
function blocked(url) {
  emit({ type: "blocked", url })
  throw new Error(`shadcn-sync blocked a request to ${url}`)
}

/** @type {Readonly<Record<string, import("./json.js").Json>>} */
const responses = mode === "replay" && snapshotPath ? JSON.parse(fs.readFileSync(snapshotPath, "utf8")) : {}
const liveFetch = globalThis.fetch

/** @param {Parameters<typeof fetch>[0]} input */
function urlOf(input) {
  if (input instanceof Request) {
    return input.url
  }

  return input instanceof URL ? input.href : input
}

globalThis.fetch = async (input, init) => {
  const url = urlOf(input)

  if (!url.startsWith(registry)) {
    return blocked(url)
  }

  const path = url.slice(registry.length).split(/[?#]/)[0] ?? ""

  if (mode === "record") {
    const response = await liveFetch(input, init)
    const body = await response.text()

    emit(response.ok ? { type: "record", path, body } : { type: "failed", path, status: response.status })

    return new Response(body, { status: response.status, headers: response.headers })
  }

  if (!Object.hasOwn(responses, path)) {
    emit({ type: "miss", path })

    return new Response("Not in shadcn-registry.json", { status: 404 })
  }

  return new Response(JSON.stringify(responses[path]), { status: 200, headers: { "content-type": "application/json" } })
}

// Registry requests all go through fetch, so any other client is blocked in both modes.
for (const module of [http, https]) {
  /** @param {string | URL | http.RequestOptions} target */
  const deny = (target) => blocked(target instanceof URL ? target.href : String(target?.toString()))

  Object.assign(module, { request: deny, get: deny })
}

// `shadcn add` always installs the items' npm dependencies and has no option to skip it. Sync owns dependencies, so
// any package-manager install runs a process that exits straight away.
const installCommand = /\b(npm|pnpm|yarn|bun)(\.cmd|\.exe)?\b[^]*\b(install|add|i)\b/
const { spawn, spawnSync, execFile, execFileSync, exec, execSync } = childProcess

/** @param {readonly unknown[]} args */
function isInstall(args) {
  const install = installCommand.test(JSON.stringify(args.slice(0, 2)))

  if (install) {
    emit({ type: "install", command: JSON.stringify(args.slice(0, 2)) })
  }

  return install
}

/**
 * exec and execFile take their callback last; the no-op process answers it with empty output.
 *
 * @param {readonly unknown[]} args
 */
function finish(args) {
  const callback = args.findLast((arg) => arg instanceof Function)

  return execFile(process.execPath, ["-e", "0"], (error) => callback?.(error, "", ""))
}

Object.assign(childProcess, {
  /** @param {Parameters<typeof spawn>} args */
  spawn: (...args) => (isInstall(args) ? spawn(process.execPath, ["-e", "0"], { stdio: "ignore" }) : spawn(...args)),
  /** @param {Parameters<typeof spawnSync>} args */
  spawnSync: (...args) =>
    isInstall(args) ? spawnSync(process.execPath, ["-e", "0"], { stdio: "ignore" }) : spawnSync(...args),
  /** @param {Parameters<typeof execFile>} args */
  execFile: (...args) => (isInstall(args) ? finish(args) : execFile(...args)),
  /** @param {Parameters<typeof execFileSync>} args */
  execFileSync: (...args) => (isInstall(args) ? Buffer.from("") : execFileSync(...args)),
  /** @param {Parameters<typeof exec>} args */
  exec: (...args) => (isInstall(args) ? finish(args) : exec(...args)),
  /** @param {Parameters<typeof execSync>} args */
  execSync: (...args) => (isInstall(args) ? Buffer.from("") : execSync(...args))
})
