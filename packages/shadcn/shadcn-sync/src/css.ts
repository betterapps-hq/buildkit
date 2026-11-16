import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import postcss, { type AtRule, type ChildNode, type Container, type Root, type Rule } from "postcss"
import { compile } from "tailwindcss"
import { SyncError } from "./errors.js"
import { resolveFile } from "./resolve.js"

/** Tailwind's layers, then the per-rule sublayers of `utilities` that keep its order across files. */
const tailwindLayers = "@layer properties, theme, base, components, utilities;"

/**
 * The parts of Preflight the components rely on, applied only to elements that carry a `data-slot`, which every
 * component part does. Nothing resets the app's own elements; other elements inside components only get the box model
 * and border color utilities assume.
 */
const scopedBase = `@layer base {
  :where([data-slot]), :where([data-slot])::before, :where([data-slot])::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0 solid;
    border-color: var(--border);
    outline-color: color-mix(in oklab, var(--ring) 50%, transparent);
  }
  :where([data-slot]) :where([class]), :where([data-slot]) :where([class])::before, :where([data-slot]) :where([class])::after {
    box-sizing: border-box;
    border-color: var(--border);
  }
  :where(button, input, select, textarea, optgroup)[data-slot] {
    font: inherit;
    font-feature-settings: inherit;
    letter-spacing: inherit;
    color: inherit;
    background-color: transparent;
    border-radius: 0;
    opacity: 1;
  }
  :where(button)[data-slot] {
    appearance: button;
  }
  :where(textarea)[data-slot] {
    resize: vertical;
  }
  :where(ol, ul, menu)[data-slot] {
    list-style: none;
  }
  :where(a)[data-slot] {
    color: inherit;
    text-decoration: inherit;
  }
  :where(h1, h2, h3, h4, h5, h6)[data-slot] {
    font-size: inherit;
    font-weight: inherit;
  }
  :where(table)[data-slot] {
    text-indent: 0;
    border-collapse: collapse;
  }
  :where(img, svg, video, canvas, iframe)[data-slot] {
    display: block;
    vertical-align: middle;
  }
}
`

/**
 * Turns the CLI's stylesheet into Tailwind input without Preflight: Tailwind's theme and utilities in their layers,
 * and the CLI's own base layer swapped for the scoped one.
 */
export function tailwindInput(cliCss: string): string {
  const root = postcss.parse(cliCss)

  root.walkAtRules("import", (rule) => {
    if (rule.params.replaceAll("'", '"') === '"tailwindcss"') {
      rule.remove()
    }
  })
  root.walkAtRules("layer", (rule) => {
    if (rule.params === "base" && rule.nodes) {
      rule.remove()
    }
  })

  return `${tailwindLayers}\n@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css" layer(utilities);\n${root.toString()}\n`
}

/** Finds a stylesheet an `@import` names, the way Tailwind resolves it: relative to the importer, or a package's CSS. */
function stylesheetPath(id: string, from: string) {
  return id.startsWith(".") ? resolve(from, id) : resolveFile(id, from, ["style", "default"])
}

/** Replaces each `@import` under `container` with the stylesheet it names, except Tailwind's own. */
function inlineImports(container: Container<ChildNode>, from: string) {
  container.walkAtRules("import", (rule) => {
    const match = /^(["'])(.+?)\1$/.exec(rule.params.trim())

    if (!match?.[2]) {
      throw new SyncError("css", `Sync can't inline @import ${rule.params}: it only inlines plain imports.`, true)
    }

    const id = match[2]

    if (id === "tailwindcss") {
      rule.remove()

      return
    }

    const path = stylesheetPath(id, from)
    const imported = postcss.parse(readFileSync(path, "utf8"))

    inlineImports(imported, dirname(path))
    rule.replaceWith(imported.nodes)
  })
}

/**
 * The stylesheet a Tailwind app imports after its own `@import "tailwindcss"`. It starts with an `@source` for the
 * generated JavaScript, so the app's Tailwind emits the components' utilities with its own, once. Then comes the CLI's
 * stylesheet as `shadcn init` would leave it in an app: the theme variables, the dark variant, the `@theme inline`
 * mapping and the style's base layer, with the style's imports (shadcn's custom variants and animations, and
 * tw-animate-css) inlined so nothing has to resolve from the generated folder.
 */
export function tailwindStylesheet(cliCss: string, base: string, iconStyles: string | undefined): string {
  const root = postcss.parse(cliCss)

  inlineImports(root, base)

  // Tailwind needs imports before everything else, so the icon library's stylesheet comes first.
  const iconImport = iconStyles ? `@import ${JSON.stringify(iconStyles)} layer(base);\n` : ""

  return `${iconImport}@source "./**/*.js";\n\n${root.toString().trim()}\n`
}

/**
 * Compiles a Tailwind mode stylesheet the way an app would, after Tailwind itself, with the candidates the components
 * use, so a stylesheet an app's Tailwind can't read fails the build instead. Returns the compiled CSS.
 */
export async function checkTailwindStylesheet(
  stylesheet: string,
  base: string,
  candidates: Iterable<string>
): Promise<string> {
  // The icon library's stylesheet resolves from the app, not from the temp project this runs in.
  const input = `@import "tailwindcss";\n${stylesheet.replace(/^@import (?!"tailwindcss").*\n/m, "")}`

  return (await compileCandidates(input, base, candidates)).toString()
}

async function compileCandidates(input: string, base: string, candidates: Iterable<string>): Promise<Root> {
  const compiler = await compile(input, {
    base,
    async loadStylesheet(id, from) {
      const path = stylesheetPath(id, from)

      return { path, base: dirname(path), content: readFileSync(path, "utf8") }
    },
    async loadModule(id) {
      throw new SyncError(
        "css",
        `The stylesheet loads a Tailwind plugin or config (${id}), which sync doesn't run.`,
        true
      )
    }
  })

  return postcss.parse(compiler.build([...candidates]))
}

/** One output rule with the at-rules it sits in, such as a `@media` variant. */
interface Leaf {
  /** The rule's text inside its at-rules. Equal rules from different builds have equal keys. */
  readonly key: string
  readonly properties: readonly string[]
  readonly specificity: number
}

function utilitiesLayer(root: Root): AtRule | undefined {
  return root.nodes.find(
    (node): node is AtRule =>
      node.type === "atrule" && node.name === "layer" && node.params === "utilities" && Boolean(node.nodes)
  )
}

function leaves(container: Container<ChildNode>, wrap: (rule: string) => string = (rule) => rule): Leaf[] {
  return (container.nodes ?? []).flatMap((node) => {
    if (node.type === "rule") {
      return [ruleLeaf(node, wrap)]
    }

    if (node.type === "atrule" && node.nodes) {
      const header = `@${node.name} ${node.params}`

      return leaves(node, (rule) => wrap(`${header} {\n${rule}\n}`))
    }

    return []
  })
}

function ruleLeaf(rule: Rule, wrap: (rule: string) => string): Leaf {
  const properties: string[] = []

  rule.walkDecls((declaration) => {
    properties.push(declaration.prop)
  })

  return { key: wrap(rule.toString()), properties, specificity: Math.max(...rule.selectors.map(specificity)) }
}

const sizeAliases = new Map([
  ["inline-size", "width"],
  ["block-size", "height"],
  ["min-inline-size", "min-width"],
  ["min-block-size", "min-height"],
  ["max-inline-size", "max-width"],
  ["max-block-size", "max-height"]
])

/**
 * The property groups a declaration competes in. Logical and physical forms of one property share a group, so
 * `padding-inline` competes with `padding-left`; a border shorthand competes with each of width, style and color.
 */
function families(property: string): string[] {
  if (property.startsWith("--")) {
    return [property]
  }

  const plain = property.replace(/^-(webkit|moz|ms)-/, "")

  for (const box of ["scroll-margin", "scroll-padding", "margin", "padding"]) {
    if (plain === box || plain.startsWith(`${box}-`)) {
      return [box]
    }
  }

  if (plain === "inset" || plain.startsWith("inset-") || ["top", "right", "bottom", "left"].includes(plain)) {
    return ["inset"]
  }

  if (plain.startsWith("border")) {
    if (plain.includes("radius")) {
      return ["border-radius"]
    }

    const part = ["color", "width", "style"].find((entry) => plain.endsWith(`-${entry}`))

    return part ? [`border-${part}`] : ["border-color", "border-width", "border-style"]
  }

  if (/^(place|align|justify)-(items|content|self)$/.test(plain)) {
    return [plain.replace(/^(place|align|justify)/, "align")]
  }

  if (plain === "gap" || plain === "row-gap" || plain === "column-gap") {
    return ["gap"]
  }

  if (plain.startsWith("overflow")) {
    return ["overflow"]
  }

  return [sizeAliases.get(plain) ?? plain]
}

/** Whether two property groups can override each other: the same group, or a shorthand and one of its longhands. */
function competes(a: string, b: string) {
  return a === b || (!a.startsWith("--") && !b.startsWith("--") && (a.startsWith(`${b}-`) || b.startsWith(`${a}-`)))
}

/** Splits a selector list or argument list at top-level commas. */
function splitTopLevel(selector: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ""

  for (const character of selector) {
    if (character === "(" || character === "[") {
      depth += 1
    } else if (character === ")" || character === "]") {
      depth -= 1
    }

    if (character === "," && depth === 0) {
      parts.push(current)
      current = ""
    } else {
      current += character
    }
  }

  return [...parts, current]
}

/** A selector's specificity as one comparable number: ids, then classes, attributes and pseudo-classes, then types. */
export function specificity(selector: string): number {
  let ids = 0
  let classes = 0
  let types = 0
  let index = 0

  while (index < selector.length) {
    const character = selector[index] ?? ""

    if (character === "\\") {
      index += 2
    } else if (character === "[") {
      classes += 1
      index = closing(selector, index, "[", "]") + 1
    } else if (character === "#") {
      ids += 1
      index = identifierEnd(selector, index + 1)
    } else if (character === ".") {
      classes += 1
      index = identifierEnd(selector, index + 1)
    } else if (character === ":") {
      const element = selector[index + 1] === ":"
      const name = /^:{1,2}([\w-]+)/.exec(selector.slice(index))?.[1] ?? ""
      const start = index + (element ? 2 : 1) + name.length
      const argumentsEnd = selector[start] === "(" ? closing(selector, start, "(", ")") : undefined

      if (argumentsEnd !== undefined && ["is", "not", "has", "matches"].includes(name)) {
        // These take the specificity of their most specific argument; :where takes none.
        const value = Math.max(...splitTopLevel(selector.slice(start + 1, argumentsEnd)).map(specificity))

        ids += Math.floor(value / 1e6)
        classes += Math.floor(value / 1e3) % 1e3
        types += value % 1e3
      } else if (element || ["before", "after", "first-line", "first-letter"].includes(name)) {
        types += 1
      } else if (name !== "where") {
        classes += 1
      }

      index = argumentsEnd === undefined ? start : argumentsEnd + 1
    } else if (/[a-zA-Z]/.test(character)) {
      types += 1
      index = identifierEnd(selector, index)
    } else {
      index += 1
    }
  }

  return ids * 1e6 + classes * 1e3 + types
}

/** The index after the identifier starting at `start`, escapes included. */
function identifierEnd(selector: string, start: number) {
  let index = start

  while (index < selector.length) {
    if (selector[index] === "\\") {
      index += 2
    } else if (/[\w-]/.test(selector[index] ?? "")) {
      index += 1
    } else {
      break
    }
  }

  return index
}

function closing(selector: string, start: number, open: string, close: string) {
  let depth = 0

  for (let index = start; index < selector.length; index += 1) {
    if (selector[index] === "\\") {
      index += 1
    } else if (selector[index] === open) {
      depth += 1
    } else if (selector[index] === close) {
      depth -= 1

      if (depth === 0) {
        return index
      }
    }
  }

  return selector.length
}

/**
 * Assigns each utility rule of the full build a sublayer so the cascade picks the same winner as Tailwind's single
 * stylesheet, whatever order the files load in. Layers are ordered by specificity first, so a more specific rule
 * still beats a less specific one. Within one specificity, a rule sits one layer above the highest earlier rule it
 * competes with, so order still decides between them; rules that never compete share low layers.
 */
function assignLayers(all: readonly Leaf[]): Map<string, number> {
  const depth = new Map<string, number>()
  const highest = new Map<number, Map<string, number>>()

  for (const leaf of all) {
    const groups = highest.get(leaf.specificity) ?? new Map<string, number>()
    const own = [...new Set(leaf.properties.flatMap(families))]
    let layer = 0

    for (const [group, index] of groups) {
      if (index >= layer && own.some((entry) => competes(entry, group))) {
        layer = index + 1
      }
    }

    for (const entry of own) {
      groups.set(entry, Math.max(layer, groups.get(entry) ?? 0))
    }

    highest.set(leaf.specificity, groups)
    depth.set(leaf.key, layer)
  }

  const offsets = new Map<number, number>()
  let next = 0

  for (const value of [...highest.keys()].toSorted((a, b) => a - b)) {
    offsets.set(value, next)
    next += Math.max(0, ...(highest.get(value)?.values() ?? [])) + 1
  }

  return new Map(all.map((leaf) => [leaf.key, (offsets.get(leaf.specificity) ?? 0) + (depth.get(leaf.key) ?? 0)]))
}

function layerName(index: number) {
  return `utilities.u${index}`
}

/** The generated stylesheets: the shared one, and one per component. */
export interface CompiledStyles {
  readonly shared: string
  readonly components: ReadonlyMap<string, string>
  readonly layers: number
}

/**
 * Compiles the catalog once for Tailwind's order and the shared rules, then each component's own utilities, each rule
 * in its sublayer. Every stylesheet starts with the same layer order statement.
 */
export async function compileStyles(
  cliCss: string,
  base: string,
  allCandidates: ReadonlySet<string>,
  componentCandidates: ReadonlyMap<string, ReadonlySet<string>>,
  iconStyles: string | undefined
): Promise<CompiledStyles> {
  const input = tailwindInput(cliCss)
  const full = await compileCandidates(input, base, allCandidates)
  const utilities = utilitiesLayer(full)
  const all = utilities ? leaves(utilities) : []
  const layers = assignLayers(all)
  const count = all.length === 0 ? 0 : Math.max(...layers.values()) + 1
  const order = `${tailwindLayers}\n@layer ${Array.from({ length: count }, (_, index) => layerName(index)).join(", ")};\n`

  utilities?.remove()

  // What's left is the theme, the properties fallback and the CLI's unlayered rules. Everything sync emits is layered,
  // so the app's own CSS wins without specificity tricks.
  const theme = postcss.atRule({ name: "layer", params: "theme" })

  // `each` keeps iterating correctly while nodes are removed.
  full.each((node) => {
    if (node.type === "rule" || (node.type === "atrule" && node.name === "keyframes")) {
      theme.append(node.remove())
    } else if (node.type === "atrule" && node.name === "layer" && !node.nodes) {
      node.remove()
    }
  })

  full.walkComments((comment) => {
    comment.remove()
  })

  if (theme.nodes?.length) {
    full.append(theme)
  }

  const iconImport = iconStyles ? `@import ${JSON.stringify(iconStyles)} layer(base);\n` : ""
  const shared = `${order}${iconImport}${full.toString().trim()}\n${scopedBase}`
  const components = new Map<string, string>()

  for (const [name, candidates] of componentCandidates) {
    const own = utilitiesLayer(await compileCandidates(input, base, candidates))
    const grouped = new Map<number, string[]>()

    for (const leaf of own ? leaves(own) : []) {
      const index = layers.get(leaf.key)

      if (index === undefined) {
        throw new SyncError("css", `${name} needs a rule the catalog build didn't produce:\n${leaf.key}`, true)
      }

      const rules = grouped.get(index) ?? []

      rules.push(leaf.key)
      grouped.set(index, rules)
    }

    const body = [...grouped]
      .toSorted(([a], [b]) => a - b)
      .map(([index, rules]) => `@layer ${layerName(index)} {\n${rules.join("\n")}\n}`)
      .join("\n")

    components.set(name, `${order}${body}\n`)
  }

  return { shared, components, layers: count }
}
