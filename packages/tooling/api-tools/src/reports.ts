import { existsSync, globSync, readFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, resolve, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { Extractor, ExtractorConfig, ExtractorLogLevel } from "@microsoft/api-extractor"

const root = fileURLToPath(new URL("../../../../", import.meta.url))
const isUpdate = process.argv.includes("--update")
const reportFolder = resolve(root, "api-reports")
const modelFolder = resolve(root, "dist/api-models")

mkdirSync(reportFolder, { recursive: true })

mkdirSync(modelFolder, { recursive: true })

// What JSON.parse returns. The manifests and configs this script reads are decoded with the guards below.
type Json = null | boolean | number | string | Json[] | JsonObject

type JsonObject = { [key: string]: Json }

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, "utf8"))
}

function isRecord(value: Json | undefined): value is JsonObject {
  return value instanceof Object && !Array.isArray(value)
}

function isString(value: Json | undefined): value is string {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- this guard is the script's JSON decoder; there is no schema library here
  return typeof value === "string"
}

function typeEntry(value: Json): string | undefined {
  if (isString(value)) {
    return /\.d\.[cm]?ts$/.test(value) ? value : undefined
  }

  if (!isRecord(value)) {
    return undefined
  }

  if (isString(value.types)) {
    return value.types
  }

  for (const condition of Object.values(value)) {
    const result = typeEntry(condition)

    if (result) {
      return result
    }
  }

  return undefined
}

function readBundledPackages(path: string): string[] {
  if (!existsSync(path)) {
    return []
  }

  const config = readJson(path)
  const bundled = isRecord(config) ? config.bundledPackages : undefined

  if (!Array.isArray(bundled) || !bundled.every(isString)) {
    throw new Error(`${path} needs a bundledPackages array of package names`)
  }

  return bundled
}

// CI can't update a baseline, so it prints the lines that differ to show what changed.
function printReportChanges(baseline: string, current: string) {
  const read = (path: string) =>
    existsSync(path) ? readFileSync(path, "utf8").replaceAll("\r\n", "\n").split("\n") : []

  const before = read(baseline)
  const after = read(current)
  const removed = before.filter((line) => !after.includes(line)).map((line) => `- ${line}`)
  const added = after.filter((line) => !before.includes(line)).map((line) => `+ ${line}`)
  const changes = [...removed, ...added]
  process.stderr.write(
    `${changes.slice(0, 40).join("\n")}\n${changes.length > 40 ? `...and ${changes.length - 40} more\n` : ""}`
  )
}

// Report names for the published package families. Better Apps keeps its own names: `better-apps` and `@better-apps/*`.
function reportName(name: string): string | undefined {
  if (name.startsWith("@buildkitgg/")) {
    return name.slice("@buildkitgg/".length)
  }

  if (name === "better-apps") {
    return name
  }

  return name.startsWith("@better-apps/") ? "better-apps-" + name.slice("@better-apps/".length) : undefined
}

const expectedReports = new Set<string>()
const models: { package: string; entryPoint: string; model: string; report: string }[] = []
let hasErrors = false

for (const manifest of globSync("packages/*/*/package.json", { cwd: root }).sort()) {
  const manifestPath = resolve(root, manifest)
  const pkg = readJson(manifestPath)

  if (!isRecord(pkg) || !isString(pkg.name)) {
    continue
  }

  const name = reportName(pkg.name)

  if (!name) {
    continue
  }

  if (!isRecord(pkg.exports)) {
    throw new Error(`${pkg.name} needs explicit exports for API discovery`)
  }

  const folder = dirname(manifestPath)
  // A package that re-exports others lists them in api-extractor.json, so their declarations and docs are analyzed
  // as its own API instead of as external references.
  const bundledPackages = readBundledPackages(resolve(folder, "api-extractor.json"))
  const exports = Object.entries(pkg.exports)
  // Conditional root exports and subpath export maps are both valid package shapes.
  const entries: [string, Json][] = exports.some(([name]) => name.startsWith(".")) ? exports : [[".", pkg.exports]]

  for (const [entryPoint, conditions] of entries) {
    if (entryPoint.endsWith(".css")) {
      continue // Asset imports may have an empty declaration shim, but do not expose a programmatic API.
    }

    const types = typeEntry(conditions)

    if (!types) {
      continue // Stylesheets and other untyped assets have no TypeScript API.
    }

    if (entryPoint.includes("*")) {
      throw new Error(`Expand typed wildcard exports before extraction: ${pkg.name}/${entryPoint}`)
    }

    const slug = name + (entryPoint === "." ? "" : "--" + entryPoint.slice(2).replaceAll("/", "--"))

    if (expectedReports.has(slug + ".api.md")) {
      throw new Error(`API report name collision: ${slug}`)
    }

    expectedReports.add(slug + ".api.md")
    const mainEntryPointFilePath = resolve(folder, types)

    const config = ExtractorConfig.prepare({
      configObjectFullPath: undefined,
      packageJsonFullPath: manifestPath,
      configObject: {
        projectFolder: folder,
        mainEntryPointFilePath,
        bundledPackages,
        compiler: {
          overrideTsconfig: {
            compilerOptions: {
              target: "ES2022",
              lib: ["ESNext", "DOM", "DOM.Iterable"],
              module: "ESNext",
              moduleResolution: "Bundler",
              jsx: "react-jsx",
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              types: []
            },
            files: [mainEntryPointFilePath]
          },
          skipLibCheck: true
        },
        apiReport: {
          enabled: true,
          reportFileName: slug,
          reportFolder,
          reportTempFolder: resolve(root, "dist/api-report-temp")
        },
        docModel: { enabled: true, apiJsonFilePath: resolve(modelFolder, slug + ".api.json") },
        dtsRollup: { enabled: false },
        tsdocMetadata: { enabled: false },
        messages: {
          extractorMessageReporting: {
            default: { logLevel: ExtractorLogLevel.Warning },
            "ae-missing-release-tag": { logLevel: ExtractorLogLevel.None },
            "ae-undocumented": { logLevel: ExtractorLogLevel.None },
            // A bundled package's internal types would be listed with this machine's node_modules path. Without the
            // report, a forgotten export in the package's own code is a warning, which fails the check.
            "ae-forgotten-export": {
              logLevel: ExtractorLogLevel.Warning,
              addToApiReportFile: bundledPackages.length === 0
            }
          }
        }
      }
    })

    process.stdout.write(`API ${pkg.name}${entryPoint === "." ? "" : entryPoint.slice(1)}\n`)

    const result = Extractor.invoke(config, {
      localBuild: isUpdate,
      showVerboseMessages: false,
      messageCallback(message) {
        // Doc comment and release tag notices inside a bundled package are upstream's to fix. Signature changes
        // still reach the report, which is where they are reviewed.
        const sourceFilePath = message.sourceFilePath?.replaceAll("\\", "/")

        if (bundledPackages.some((bundled) => sourceFilePath?.includes(`/node_modules/${bundled}/`))) {
          message.logLevel = ExtractorLogLevel.None
        }

        // RTK deliberately ships this helper as TS behind a declaration import. Analyze it normally;
        // downgrade only this upstream packaging notice, never our source files or signature checks.
        if (
          message.messageId === "ae-wrong-input-file-type" &&
          message.sourceFilePath
            ?.replaceAll("\\", "/")
            .endsWith("/node_modules/@reduxjs/toolkit/dist/uncheckedindexed.ts")
        ) {
          message.logLevel = ExtractorLogLevel.Info
        }
      }
    })

    hasErrors ||= !result.succeeded

    if (result.apiReportChanged && !isUpdate) {
      printReportChanges(
        resolve(reportFolder, slug + ".api.md"),
        resolve(root, "dist/api-report-temp", slug + ".api.md")
      )
    }

    models.push({
      package: pkg.name,
      entryPoint,
      model: slug + ".api.json",
      report: relative(root, resolve(reportFolder, slug + ".api.md")).replaceAll("\\", "/")
    })
  }
}

// Removed or renamed entry points must be reviewed too; stale baselines never disappear silently.
for (const file of readdirSync(reportFolder).filter((file) => file.endsWith(".api.md"))) {
  if (!expectedReports.has(file)) {
    process.stderr.write(`Remove the obsolete API baseline after reviewing its deletion: api-reports/${file}\n`)
    hasErrors = true
  }
}

writeFileSync(resolve(modelFolder, "index.json"), JSON.stringify(models, null, 2) + "\n")

if (models.length === 0) {
  throw new Error("No public typed entry points discovered")
}

if (hasErrors) {
  process.stderr.write(
    "API verification failed. Review changes, run pnpm api:update, and commit the updated baselines.\n"
  )
  process.exitCode = 1
} else {
  process.stdout.write(`${models.length} typed entry points ${isUpdate ? "updated" : "verified"}.\n`)
}
