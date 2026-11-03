import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Extractor, ExtractorConfig, ExtractorLogLevel } from "@microsoft/api-extractor"
import { exclusions, upstreams, type Exclusion, type Upstream } from "../curation.ts"

const folder = resolve(fileURLToPath(new URL("../", import.meta.url)))
const isCheck = process.argv.includes("--check")
const require = createRequire(import.meta.url)
const cache = resolve(folder, "node_modules/.cache/typescript-utils")
mkdirSync(cache, { recursive: true })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

type Entry = {
  /** Name exported by this package. */
  name: string
  /** Name exported by the upstream package. */
  upstreamName: string
  from: string
  version: string
  kind: "value" | "type"
  source: string
  docs?: string
}

// API Extractor lists every declared export, types included, with the declaration file it comes from.
function declaredExports(upstream: Upstream, packageFolder: string) {
  const mainEntryPointFilePath = resolve(packageFolder, upstream.types)
  const apiJsonFilePath = resolve(cache, upstream.name + ".api.json")
  const config = ExtractorConfig.prepare({
    configObjectFullPath: undefined,
    packageJsonFullPath: resolve(folder, "package.json"),
    configObject: {
      projectFolder: folder,
      mainEntryPointFilePath,
      bundledPackages: [upstream.name],
      compiler: {
        overrideTsconfig: {
          compilerOptions: {
            target: "ES2022",
            lib: ["ESNext", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "Bundler",
            strict: true,
            skipLibCheck: true,
            types: []
          },
          files: [mainEntryPointFilePath]
        },
        skipLibCheck: true
      },
      apiReport: { enabled: false },
      docModel: { enabled: true, apiJsonFilePath },
      dtsRollup: { enabled: false },
      tsdocMetadata: { enabled: false },
      messages: {
        compilerMessageReporting: { default: { logLevel: ExtractorLogLevel.Warning } },
        extractorMessageReporting: { default: { logLevel: ExtractorLogLevel.None } },
        tsdocMessageReporting: { default: { logLevel: ExtractorLogLevel.None } }
      }
    }
  })
  if (!Extractor.invoke(config, { localBuild: true, showVerboseMessages: false }).succeeded) {
    throw new Error(`API Extractor could not read the declarations of ${upstream.name}`)
  }
  const model: unknown = JSON.parse(readFileSync(apiJsonFilePath, "utf8"))
  const entryPoint = isRecord(model) && Array.isArray(model.members) ? model.members[0] : undefined
  if (!isRecord(entryPoint) || !Array.isArray(entryPoint.members)) {
    throw new Error(`Unexpected API model for ${upstream.name}`)
  }
  // Overloads appear once per signature. Keep the first declaration of each name.
  const declarations = new Map<string, string>()
  for (const member of entryPoint.members) {
    if (!isRecord(member) || typeof member.name !== "string" || typeof member.fileUrlPath !== "string") {
      throw new Error(`Unexpected API model member in ${upstream.name}`)
    }
    if (!declarations.has(member.name)) {
      const file = relative(packageFolder, resolve(folder, member.fileUrlPath)).replaceAll("\\", "/")
      declarations.set(member.name, file)
    }
  }
  return declarations
}

async function upstreamEntries(upstream: Upstream): Promise<Entry[]> {
  const manifestPath = require.resolve
    .paths(upstream.name)
    ?.map((modules) => resolve(modules, upstream.name, "package.json"))
    .find((path) => existsSync(path))
  if (!manifestPath) {
    throw new Error(`${upstream.name} is not installed`)
  }
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"))
  if (!isRecord(manifest) || typeof manifest.version !== "string") {
    throw new Error(`${upstream.name} has no version`)
  }
  const version = manifest.version
  const declarations = declaredExports(upstream, dirname(manifestPath))
  // Runtime exports are the values. Declared names without one are types.
  const module: Record<string, unknown> = upstream.typesOnly ? {} : await import(upstream.name)
  const runtime = new Set(Object.keys(module))
  const rename = upstream.rename ?? {}
  const renamedFrom = new Map(Object.entries(rename).map(([from, to]) => [to, from]))
  for (const name of runtime) {
    if (declarations.has(name) || name in rename) {
      continue
    }
    // API Extractor suffixes an export that shadows a global, such as `isFinite`, as `isFinite_2`.
    const suffixed = [...declarations.keys()].find((declared) => new RegExp(`^${name}_\\d+$`).test(declared))
    if (suffixed) {
      declarations.set(name, declarations.get(suffixed) ?? "")
      declarations.delete(suffixed)
      continue
    }
    // API Extractor models an aliased export, such as `export { Pattern, Pattern as P }`, once.
    const original = [...declarations.keys()].find(
      (declared) => runtime.has(declared) && module[declared] === module[name]
    )
    const declaration = original && declarations.get(original)
    if (!declaration) {
      throw new Error(`${upstream.name} exports ${name} at runtime without a declaration`)
    }
    declarations.set(name, declaration)
  }
  const unresolved = [...declarations.keys()].filter((name) => /_\d+$/.test(name) && !runtime.has(name))
  if (unresolved.length) {
    throw new Error(`API Extractor renamed ${upstream.name} exports it could not match: ${unresolved.join(", ")}`)
  }
  const tree = `https://github.com/${upstream.repository}/blob/v${version}/`
  return [...declarations]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([declaredName, declaration]) => {
      const upstreamName = renamedFrom.get(declaredName) ?? declaredName
      const docs = upstream.docs?.(declaredName, declaration)
      return {
        name: declaredName,
        upstreamName,
        from: upstream.name,
        version,
        kind: runtime.has(upstreamName) ? "value" : "type",
        source: tree + upstream.source(declaration, declaredName),
        ...(docs ? { docs } : {})
      }
    })
}

const all = (await Promise.all(upstreams.map(upstreamEntries))).flat()

function find(choice: Exclusion) {
  const entry = all.find((candidate) => candidate.upstreamName === choice.name && candidate.from === choice.from)
  if (!entry) {
    throw new Error(`${choice.from} no longer exports ${choice.name}. Remove it from curation.ts.`)
  }
  return entry
}
const excluded = new Set(exclusions.map(find))
const entries = all.filter((entry) => !excluded.has(entry))
const owners = Map.groupBy(entries, (entry) => entry.name)
const collisions = [...owners].filter(([, owned]) => owned.length > 1)
if (collisions.length) {
  const list = collisions.map(([name, owned]) => `${name} (${owned.map((entry) => entry.from).join(", ")})`)
  throw new Error(`Exclude one side of each name collision in curation.ts: ${list.join("; ")}`)
}

const header = "Generated by scripts/generate.ts from curation.ts. Do not edit."
function specifier(entry: Entry) {
  return entry.upstreamName === entry.name ? entry.name : `${entry.upstreamName} as ${entry.name}`
}
function exportList(keyword: string, names: string[], from: string) {
  return names.length ? `${keyword} {\n${names.map((name) => `  ${name}`).join(",\n")}\n} from "${from}"\n` : ""
}
const barrel = [
  `// ${header}\n/// <reference types="@total-typescript/ts-reset" preserve="true" />\n`,
  ...upstreams.map((upstream) => {
    const own = entries.filter((entry) => entry.from === upstream.name)
    const values = own.filter((entry) => entry.kind === "value").map(specifier)
    const types = own.filter((entry) => entry.kind === "type").map(specifier)
    return exportList("export", values, upstream.name) + exportList("export type", types, upstream.name)
  })
].join("\n")

const manifest =
  JSON.stringify(
    entries.map(({ upstreamName, ...entry }) => ({
      ...entry,
      ...(upstreamName === entry.name ? {} : { upstreamName })
    })),
    null,
    2
  ) + "\n"

const agents = `<!-- ${header} -->

# @buildkitgg/typescript-utils

One curated import for TypeScript utilities. Import everything from \`@buildkitgg/typescript-utils\`. Do not install or
import the upstream packages directly: this package pins their versions and settles where they overlap.

Once any file imports this package, [ts-reset](https://github.com/total-typescript/ts-reset)'s recommended rules apply
to the whole program. \`JSON.parse\` and \`response.json()\` return \`unknown\`, \`.filter(Boolean)\` removes falsy
types, \`Array.isArray\` narrows to \`unknown[]\`, and \`.catch\` callbacks receive \`unknown\`. Narrow these values
instead of casting them. When setting up a project, add \`"@buildkitgg/typescript-utils/reset"\` to
\`compilerOptions.types\` in tsconfig.json so the rules apply before any file imports the package, keeping any \`@types\`
packages the project relies on in the same list.

Each export below keeps its upstream signature and documentation. Source and documentation links for every export are
in \`reexports.json\`.

## Choices

Use the replacement instead of these upstream exports. They are deliberately not exported.

| Export | Package | Why | Use instead |
| --- | --- | --- | --- |
${exclusions.map((choice) => `| \`${choice.name}\` | ${choice.from} | ${choice.reason} | ${choice.instead} |`).join("\n")}

## Exports

${upstreams
  .map((upstream) => {
    const own = entries.filter((entry) => entry.from === upstream.name)
    const version = own[0]?.version ?? ""
    const list = (kind: Entry["kind"]) =>
      own
        .filter((entry) => entry.kind === kind)
        .map((entry) => `\`${entry.name}\``)
        .join(", ")
    const values = list("value")
    const types = list("type")
    return `### ${upstream.name} ${version}\n\n[Documentation](https://github.com/${upstream.repository}/tree/v${version}#readme)\n\n${values ? `Values: ${values}\n` : ""}${values && types ? "\n" : ""}${types ? `Types: ${types}\n` : ""}`
  })
  .join("\n")}`

const outputs: [string, string][] = [
  ["src/index.ts", barrel],
  ["reexports.json", manifest],
  ["AGENTS.md", agents]
]
const stale: string[] = []
for (const [path, content] of outputs) {
  const file = resolve(folder, path)
  if (isCheck) {
    let current = ""
    try {
      current = readFileSync(file, "utf8")
    } catch {
      // A missing file is stale.
    }
    if (current !== content) {
      stale.push(path)
    }
  } else {
    writeFileSync(file, content)
  }
}
if (stale.length) {
  process.stderr.write(`Out of date: ${stale.join(", ")}. Run pnpm --filter @buildkitgg/typescript-utils generate.\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`${entries.length} exports ${isCheck ? "verified" : "generated"}.\n`)
}
