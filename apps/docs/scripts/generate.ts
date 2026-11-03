import { execFileSync } from "node:child_process"
import { cpSync, existsSync, globSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve, relative, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { documentationSections, packagePages, type PackageEntry } from "../navigation.ts"

const app = resolve(fileURLToPath(new URL("../", import.meta.url)))
const root = resolve(app, "../..")
const content = resolve(app, "content")
const modelFolder = resolve(root, "dist/api-models")
const require = createRequire(import.meta.url)
const documenter = resolve(dirname(require.resolve("@microsoft/api-documenter/package.json")), "bin/api-documenter")

// What JSON.parse returns. Every file this script reads is decoded with the guards below.
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

type Upstream = { from: string; version: string; source: string; docs?: string }

// A package that re-exports other packages lists where each export comes from in reexports.json.
function readUpstream(path: string): Map<string, Upstream> | undefined {
  if (!existsSync(path)) {
    return undefined
  }

  const entries = readJson(path)

  if (!Array.isArray(entries)) {
    throw new Error(`${path} must list exports`)
  }

  return new Map(
    entries.map((entry) => {
      if (
        !isRecord(entry) ||
        !isString(entry.name) ||
        !isString(entry.from) ||
        !isString(entry.version) ||
        !isString(entry.source)
      ) {
        throw new Error(`Invalid export in ${path}`)
      }

      const upstream: Upstream = { from: entry.from, version: entry.version, source: entry.source }

      if (isString(entry.docs) && entry.docs) {
        upstream.docs = entry.docs
      }

      return [entry.name, upstream]
    })
  )
}

const pageSuffix = "_type"

// API Documenter names pages by the lowercased export name, so `camelCase` and `CamelCase` would overwrite one page.
// Rename every export but the first of each such group in the staged model. Pages show the original name again.
function separateCaseCollisions(json: string, packageName: string) {
  const model: Json = JSON.parse(json)
  const entryPoint = isRecord(model) && Array.isArray(model.members) ? model.members[0] : undefined

  if (!isRecord(entryPoint) || !Array.isArray(entryPoint.members)) {
    return json
  }

  const seen = new Map<string, string>()
  const renamed = new Set<string>()

  for (const member of entryPoint.members) {
    if (!isRecord(member) || !isString(member.name)) {
      continue
    }

    const key = member.name.toLowerCase()
    const first = seen.get(key)

    if (first === undefined) {
      seen.set(key, member.name)
    } else if (first !== member.name) {
      renamed.add(member.name)
    }
  }

  let result = json

  for (const name of renamed) {
    const escaped = name.replace(/[$]/g, "\\$&")
    result = result
      .replace(new RegExp(`"name": "${escaped}"`, "g"), `"name": "${name}${pageSuffix}"`)
      .replace(new RegExp(`${packageName}!${escaped}([:#~.])`, "g"), `${packageName}!${name}${pageSuffix}$1`)
  }

  return result
}

// Upstream doc comments can hold raw HTML or mustaches, such as `<div>` in an example, which VitePress would compile
// as Vue. Escape them outside code. API Documenter's own table markup stays.
function escapeUpstreamMarkup(page: string) {
  let isFenced = false

  return page
    .split("\n")
    .map((line) => {
      if (line.startsWith("```")) {
        isFenced = !isFenced
      }

      if (isFenced || line.startsWith("```")) {
        return line
      }

      return line
        .split(/(`[^`]*`)/)
        .map((part, index) =>
          index % 2
            ? part
            : part
                .replace(/<(?!\/?(?:table|thead|tbody|tr|th|td)>)(?=[A-Za-z/])/g, "&lt;")
                .replaceAll("{{", "&#123;&#123;")
        )
        .join("")
    })
    .join("\n")
}

// Show re-exported names as upstream names, and link each export's page to its upstream source and documentation.
function linkUpstream(source: string, upstream: Map<string, Upstream>) {
  const page = escapeUpstreamMarkup(source)

  const original = (name: string) => {
    const base = name.replace(new RegExp(`\\\\_(${pageSuffix.slice(1)}|\\d+)$`), "")

    return upstream.has(base) ? base : name
  }

  const named = page
    .replace(/\[([A-Za-z0-9$]+(?:\\_(?:[a-z]+|\d+)))\]/g, (_, name: string) => `[${original(name)}]`)
    .replace(/^## ([A-Za-z0-9$]+\\_(?:[a-z]+|\d+))(?=(\(\))? )/m, (_, name: string) => `## ${original(name)}`)

  const heading = /^## ([A-Za-z0-9$]+)(\(\))? [a-z]+$/m.exec(named)
  const breadcrumb = /^\[Home\]\(.+$/m.exec(named)?.[0] ?? ""
  const entry = heading?.[1] && upstream.get(heading[1])

  // Only an export's own page: members such as `P.string` have a deeper breadcrumb.
  if (!heading || !entry || breadcrumb.split("&gt;").length !== 3) {
    return named
  }

  const docs = entry.docs ? ` [Documentation](${entry.docs}).` : ""

  return named.replace(
    heading[0],
    `${heading[0]}\n\nRe-exported from ${entry.from} ${entry.version}. [Source](${entry.source}).${docs}`
  )
}

const input = readJson(resolve(modelFolder, "index.json"))

if (!Array.isArray(input) || input.length === 0) {
  throw new Error("Generate API models first: pnpm check:api")
}

const models = input.map((value) => {
  if (!isRecord(value) || !isString(value.package) || !isString(value.entryPoint) || !isString(value.model)) {
    throw new Error("Invalid API model index")
  }

  return { package: value.package, entryPoint: value.entryPoint, model: value.model }
})

// Only these generated directories may be replaced. Resolve and verify before recursive removal.
for (const directory of [
  resolve(content, "reference"),
  resolve(content, "packages"),
  resolve(app, "dist/documenter-inputs")
]) {
  if (!directory.startsWith(app + sep)) {
    throw new Error("Generated path escapes the docs app")
  }

  rmSync(directory, { recursive: true, force: true })
  mkdirSync(directory, { recursive: true })
}

const catalog: PackageEntry[] = []

const groups = new Map([
  ["core", "Core"],
  ["react", "React"],
  ["shadcn", "shadcn"],
  ["fluentui", "Fluent UI"],
  ["tooling", "Developer tools"]
])

for (const manifest of globSync("packages/*/*/package.json", { cwd: root }).sort()) {
  const manifestPath = resolve(root, manifest)
  const pkg = readJson(manifestPath)

  if (!isRecord(pkg) || !isString(pkg.name) || !pkg.name.startsWith("@buildkitgg/")) {
    continue
  }

  // Private repo tooling has no exports, so there is no API to document.
  if (pkg.private === true && !isRecord(pkg.exports)) {
    continue
  }

  const name = pkg.name.slice("@buildkitgg/".length)
  const packageModels = models.filter((model) => model.package === pkg.name)

  if (!packageModels.length) {
    throw new Error(`No API models for ${pkg.name}`)
  }

  const packageFolder = dirname(manifestPath)
  const guideFolder = resolve(content, "packages", name)
  mkdirSync(guideFolder, { recursive: true })
  const readme = readFileSync(resolve(packageFolder, "README.md"), "utf8")

  // Preserve in-page anchors; retain the source location of relative maintenance links.
  const guide = readme.replace(/\]\(([^)]+)\)/g, (match: string, href: string) => {
    if (/^(https?:|mailto:|#)/.test(href)) {
      return match
    }

    const [path, anchor] = href.split("#")
    const repositoryPath = relative(root, resolve(packageFolder, path ?? "")).replaceAll("\\", "/")

    return `](https://github.com/AndrewCraswell/buildkit/blob/main/${repositoryPath}${anchor ? "#" + anchor : ""})`
  })

  const upstream = readUpstream(resolve(packageFolder, "reexports.json"))
  const entryLinks: { name: string; link: string }[] = []

  for (const model of packageModels) {
    const entrySlug = model.entryPoint === "." ? "root" : model.entryPoint.slice(2).replaceAll("/", "--")
    const importPath = pkg.name + (model.entryPoint === "." ? "" : model.entryPoint.slice(1))
    const output = resolve(content, "reference", name, entrySlug)
    const staging = resolve(app, "dist/documenter-inputs", name, entrySlug)
    mkdirSync(staging, { recursive: true })
    writeFileSync(
      resolve(staging, model.model),
      separateCaseCollisions(readFileSync(resolve(modelFolder, model.model), "utf8"), pkg.name)
    )
    execFileSync(process.execPath, [documenter, "markdown", "--input-folder", staging, "--output-folder", output], {
      stdio: ["ignore", "pipe", "pipe"]
    })
    const packagePage = readdirSync(output).find((file) => file === `${name}.md`)

    if (!packagePage) {
      throw new Error(`API Documenter did not generate ${name}.md`)
    }

    const link = `/reference/${name}/${entrySlug}/${name}`
    entryLinks.push({ name: importPath, link })

    for (const file of readdirSync(output).filter((file) => file.endsWith(".md"))) {
      const filePath = resolve(output, file)
      const page = upstream ? linkUpstream(readFileSync(filePath, "utf8"), upstream) : readFileSync(filePath, "utf8")
      writeFileSync(filePath, `---\neditLink: false\n---\n\n> Import path: \`${importPath}\`\n\n${page}`)
    }

    writeFileSync(
      resolve(output, "index.md"),
      `# ${importPath}\n\nGenerated from public TypeScript declarations and doc comments.\n\n[Browse this entry point](${link})\n`
    )
  }

  const pages = packagePages(name)

  const additionalReference = pages.length
    ? `\n\n## Further reference\n\n${pages.map((page) => `- [${page.text}](${page.link})`).join("\n")}`
    : ""

  writeFileSync(
    resolve(guideFolder, "index.md"),
    `---\neditLink: false\n---\n\n${guide}${additionalReference}\n\n## API reference\n\n${entryLinks.map((entry) => `- [\`${entry.name}\`](${entry.link})`).join("\n")}\n`
  )
  const area = manifest.replaceAll("\\", "/").split("/")[1] ?? ""
  catalog.push({ name, layer: groups.get(area) ?? area, guide: `/packages/${name}/`, entries: entryLinks })
}

writeFileSync(resolve(content, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n")

const sections = documentationSections(catalog)

const packageIndex = sections
  .map(
    (section) =>
      `## ${section.text}\n\n${section.link ? `[Overview](${section.link})\n\n` : ""}${section.packages
        .map((pkg) => `- [${pkg.title}](${pkg.guide})`)
        .join("\n")}`
  )
  .join("\n\n")

writeFileSync(
  resolve(content, "packages/index.md"),
  `# Package guides\n\nInstallation and usage, rendered from each package’s README.\n\n${packageIndex}\n`
)

writeFileSync(
  resolve(content, "reference/index.md"),
  `# API reference\n\nGenerated from public exports with Microsoft API Extractor and API Documenter. Subpath imports have their own reference pages. Explanations appear where the source has doc comments.\n\n${sections.map((section) => `## ${section.text}\n\n${section.packages.map((pkg) => `### ${pkg.title}\n\n${pkg.entries.map((entry) => `- [\`${entry.name}\`](${entry.link})`).join("\n")}`).join("\n\n")}`).join("\n\n")}\n`
)

mkdirSync(resolve(content, "public"), { recursive: true })

cpSync(resolve(root, "apps/site/public/mark.svg"), resolve(content, "public/mark.svg"))

process.stdout.write(`Generated ${catalog.length} package guides and ${models.length} entry-point references.\n`)

// Import command definitions, not the CLI entry point. Reading metadata never calls setup or run. Apart from those
// handlers the definitions are plain data, so a JSON copy keeps all of it and decodes like the files above.
const cli = await import(pathToFileURL(resolve(root, "packages/tooling/dev-domains/dist/cli/commands.js")).href)

const commands: Json | undefined =
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- structuredClone throws on the handlers this leaves out
  cli.commands === undefined ? undefined : JSON.parse(JSON.stringify(cli.commands))

if (!isRecord(commands)) {
  throw new Error("The dev-domains command definitions are unavailable")
}

const commandSections = Object.entries(commands)
  .map(([name, definition]) => {
    if (!isRecord(definition) || !isRecord(definition.meta) || !isString(definition.meta.description)) {
      throw new Error(`Unsupported command metadata for ${name}`)
    }

    const args = definition.args ?? {}

    if (!isRecord(args)) {
      throw new Error(`Unsupported argument metadata for ${name}`)
    }

    const rows = Object.entries(args).map(([argName, arg]) => {
      if (!isRecord(arg) || !isString(arg.type)) {
        throw new Error(`Unsupported argument metadata for ${name}.${argName}`)
      }

      const flag = arg.type === "positional" ? argName : "--" + argName
      const detail = isString(arg.description) ? arg.description : ""
      const defaultValue = "default" in arg ? JSON.stringify(arg.default) : "—"

      return `| \`${flag}\` | ${arg.type} | ${arg.required ? "Yes" : "No"} | ${defaultValue} | ${detail} |`
    })

    const argumentReference = rows.length
      ? `| Argument | Type | Required | Default | Description |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`
      : "No command-specific arguments.\n"

    return `## ${name}\n\n${definition.meta.description}\n\n\`\`\`sh\nnpx @buildkitgg/dev-domains ${name} --help\n\`\`\`\n\n${argumentReference}`
  })
  .join("\n")

writeFileSync(
  resolve(content, "packages/dev-domains/commands.md"),
  `---\neditLink: false\n---\n\n# dev-domains CLI reference\n\nPart of the [dev-domains documentation](/packages/dev-domains/). See the guide for installation, configuration, and examples.\n\nGenerated from the CLI’s command and argument definitions. These commands run in a terminal, not in this page.\n\n${commandSections}`
)
