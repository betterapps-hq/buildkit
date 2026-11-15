import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import * as z from "zod"
import { SyncError } from "./errors.js"
import { json, readJson, type Json } from "./json.js"
import { isBuiltInIcons, registryStyle, type SyncSettings } from "./options.js"
import { findPackage } from "./resolve.js"
import { registryUrl, type RegistryResponses, type RegistrySnapshot, snapshotFile } from "./snapshot.js"

// shadcn doesn't export its package.json, so its folder is found the way Node finds packages.
const shadcnDirectory = findPackage("shadcn", import.meta.dirname) ?? "shadcn"
const shadcnManifest = join(shadcnDirectory, "package.json")
const preload = fileURLToPath(new URL("./preload.cjs", import.meta.url))

/** The pinned shadcn CLI version sync drives. */
export const shadcnVersion = readJson(shadcnManifest, z.object({ version: z.string() })).version

/** The temp project's layout. Sources land in `src/`, which becomes the generated package's root. */
const aliases = {
  components: "@/blocks",
  utils: "@/lib/utils",
  ui: "@/ui",
  lib: "@/lib",
  hooks: "@/hooks"
}

const preloadEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("record"), path: z.string(), body: z.string() }),
  z.object({ type: z.literal("miss"), path: z.string() }),
  z.object({ type: z.literal("failed"), path: z.string(), status: z.number() }),
  z.object({ type: z.literal("blocked"), url: z.string() }),
  z.object({ type: z.literal("install"), command: z.string() })
])

/** How the CLI's registry requests are answered: live and recorded, or from a snapshot with the network blocked. */
export type RegistrySource =
  | { readonly mode: "record" }
  | { readonly mode: "replay"; readonly snapshot: RegistrySnapshot }

function writeJsonFile(path: string, value: Json) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n")
}

/** Creates the temp project the shadcn CLI installs into: `components.json`, `package.json`, `tsconfig.json` and CSS. */
export function createWorkspace(directory: string, settings: SyncSettings) {
  rmSync(directory, { recursive: true, force: true })
  mkdirSync(join(directory, "src"), { recursive: true })
  writeJsonFile(join(directory, "components.json"), {
    $schema: "https://ui.shadcn.com/schema.json",
    style: registryStyle(settings),
    rsc: true,
    tsx: true,
    tailwind: { config: "", css: "src/index.css", baseColor: settings.theme, cssVariables: true, prefix: "" },
    // Adapters rewrite the CLI's Lucide output, so the CLI always installs a library it knows.
    iconLibrary: isBuiltInIcons(settings.icons) ? settings.icons : "lucide",
    aliases
  })
  writeJsonFile(join(directory, "package.json"), {
    name: "buildkit-shadcn-workspace",
    private: true,
    type: "module",
    dependencies: { react: "^19.2.0", "react-dom": "^19.2.0", tailwindcss: "^4.0.0" }
  })
  writeJsonFile(join(directory, "tsconfig.json"), {
    compilerOptions: { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", paths: { "@/*": ["./src/*"] } },
    include: ["src"]
  })
  writeFileSync(join(directory, "src/index.css"), '@import "tailwindcss";\n')
}

/**
 * The selected theme as a local `registry:theme` item, built from the base color the CLI fetched. `shadcn add` with
 * this item writes the theme variables and their Tailwind mapping into the project's CSS, as `init` would, without the
 * project scaffolding `init` brings.
 */
function themeItem(responses: RegistryResponses, theme: string): Json {
  const color = z
    .object({
      cssVarsV4: z.object({ light: z.record(z.string(), z.string()), dark: z.record(z.string(), z.string()) })
    })
    .safeParse(responses[`colors/${theme}.json`])

  if (!color.success) {
    throw new SyncError("registry", `The registry has no ${theme} theme.`, true)
  }

  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: `buildkit-theme-${theme}`,
    type: "registry:theme",
    cssVars: color.data.cssVarsV4
  }
}

interface ShadcnRun {
  readonly responses: Record<string, Json>
  readonly output: string
}

function runShadcn(directory: string, args: readonly string[], source: RegistrySource, verbose: boolean): ShadcnRun {
  const events = join(directory, ".shadcn-events.jsonl")
  const snapshotPath = join(directory, ".shadcn-responses.json")

  rmSync(events, { force: true })

  if (source.mode === "replay") {
    writeFileSync(snapshotPath, JSON.stringify(source.snapshot.responses))
  }

  const bin = join(shadcnDirectory, "dist/index.js")

  // The CLI runs in the temp project with relative arguments: it reads Windows paths such as `D:/` as URLs.
  const result = spawnSync(process.execPath, ["--require", preload, bin, ...args], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      BUILDKIT_SHADCN_MODE: source.mode,
      BUILDKIT_SHADCN_REGISTRY: `${registryUrl}/`,
      BUILDKIT_SHADCN_EVENTS: events,
      BUILDKIT_SHADCN_RESPONSES: snapshotPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  const output = `${result.stdout}${result.stderr}`
  const log = existsSync(events) ? readFileSync(events, "utf8").trim().split("\n").filter(Boolean) : []
  const responses: Record<string, Json> = {}

  for (const line of log) {
    const event = preloadEvent.parse(JSON.parse(line))

    if (verbose && event.type !== "record") {
      const { type, ...detail } = event

      process.stdout.write(`  shadcn ${type}: ${Object.values(detail).join(" ")}\n`)
    }

    switch (event.type) {
      case "record":
        responses[event.path] = json.parse(JSON.parse(event.body))
        break
      case "miss":
        throw new SyncError(
          "registry",
          `shadcn ${shadcnVersion} asked for ${event.path}, which ${snapshotFile} doesn't have.\nRun update to record a fresh snapshot.`,
          true
        )
      case "failed":
        throw new SyncError(
          "registry",
          `${registryUrl} answered ${event.status} for ${event.path}.\nCheck the --base, --style and --theme values, then try again.`,
          true
        )
      case "blocked":
        throw new SyncError(
          "installation",
          `The shadcn CLI tried to reach ${event.url}, which sync doesn't allow.`,
          true
        )
      case "install":
        break
    }
  }

  if (result.status !== 0) {
    const offline = source.mode === "record" && /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/.test(output)

    throw new SyncError(
      offline ? "registry" : "installation",
      offline
        ? `Can't reach ${registryUrl} to fetch the ${args.includes("--all") ? "component" : "theme"} registry.\nCheck your connection and try again.`
        : `shadcn ${args.join(" ")} failed:\n${output.trim()}`,
      true
    )
  }

  return { responses, output }
}

/**
 * Installs the whole catalog and the theme into the temp project with the shadcn CLI. Returns every registry response
 * the CLI received, recorded live or replayed from the snapshot.
 */
export function installCatalog(
  directory: string,
  settings: SyncSettings,
  source: RegistrySource,
  verbose: boolean
): RegistryResponses {
  const catalog = runShadcn(directory, ["add", "--all", "--yes", "--silent"], source, verbose)
  const known = source.mode === "replay" ? source.snapshot.responses : catalog.responses

  writeJsonFile(join(directory, "buildkit-theme.json"), themeItem(known, settings.theme))

  const theme = runShadcn(
    directory,
    ["add", "style", "./buildkit-theme.json", "--yes", "--silent", "--overwrite"],
    source,
    verbose
  )

  return source.mode === "replay" ? source.snapshot.responses : { ...catalog.responses, ...theme.responses }
}
