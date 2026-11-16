import { basename, dirname, join, posix, relative, sep } from "node:path"
import { Node, Project, type SourceFile } from "ts-morph"
import type { ShadcnIconAdapter } from "./adapter.js"
import { swapCnImports } from "./cn.js"
import { SyncError } from "./errors.js"
import { applyAdapter, type UnmappedIcon } from "./icons.js"
import { packageName } from "./resolve.js"

/** One component the generated package exports: a `ui/` module and what it exports. */
export interface ComponentModule {
  readonly name: string
  /** Path of the `ui/` module under `src/`, with forward slashes. */
  readonly path: string
  readonly values: readonly string[]
  readonly types: readonly string[]
  /**
   * The component's module and the local modules it reaches without passing through another component, whose classes
   * its stylesheet covers. Other components it composes import their own stylesheets.
   */
  readonly modules: readonly string[]
}

/** A `hooks/` or `lib/` module the generated package exports at its own path, and what it exports. */
export interface SharedModule {
  /** Path under `src/`, with forward slashes, such as `lib/utils.ts`. */
  readonly path: string
  readonly values: readonly string[]
  readonly types: readonly string[]
}

/** The installed sources after sync's rewrites, ready to compile. */
export interface PreparedSources {
  readonly project: Project
  readonly components: readonly ComponentModule[]
  readonly shared: readonly SharedModule[]
  /** The packages the sources import, by package name. */
  readonly packages: readonly string[]
  /** Class candidates per source path: every whitespace-separated word in a string or template literal. */
  readonly candidates: ReadonlyMap<string, ReadonlySet<string>>
}

function slashes(path: string) {
  return path.split(sep).join("/")
}

function localTarget(file: SourceFile, root: string, specifier: string): string | undefined {
  const base = specifier.startsWith("@/")
    ? join(root, specifier.slice(2))
    : join(dirname(file.getFilePath()), specifier)

  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (file.getProject().getSourceFile(candidate)) {
      return candidate
    }
  }

  return undefined
}

function withJsExtension(fromFile: string, target: string) {
  const path = slashes(relative(dirname(fromFile), target)).replace(/\.tsx?$/, ".js")

  return path.startsWith(".") ? path : `./${path}`
}

function literalWords(file: SourceFile): Set<string> {
  const words = new Set<string>()

  for (const node of file.getDescendants()) {
    const literal =
      Node.isStringLiteral(node) ||
      Node.isNoSubstitutionTemplateLiteral(node) ||
      Node.isTemplateHead(node) ||
      Node.isTemplateMiddle(node) ||
      Node.isTemplateTail(node)

    const text = literal ? node.getLiteralText() : undefined

    for (const word of text?.split(/\s+/) ?? []) {
      if (word) {
        words.add(word)
      }
    }
  }

  return words
}

/** A module's exported names, split into values and type-only names, each sorted. */
function exportsOf(file: SourceFile) {
  const values: string[] = []
  const types: string[] = []

  for (const [name, declarations] of file.getExportedDeclarations()) {
    const typeOnly = declarations.every(
      (declaration) => Node.isInterfaceDeclaration(declaration) || Node.isTypeAliasDeclaration(declaration)
    )

    ;(typeOnly ? types : values).push(name)
  }

  return { values: values.toSorted(), types: types.toSorted() }
}

/**
 * Loads the CLI's output from `src/`, points `cn` imports at the swappable module, turns its aliases into relative
 * `.js` imports, applies an icon adapter, and checks that every icon placeholder was replaced and every local import
 * resolves.
 */
export function prepareSources(root: string, adapter: ShadcnIconAdapter | undefined, adapterName: string) {
  const project = new Project({ skipAddingFilesFromTsConfig: true })

  project.addSourceFilesAtPaths([join(root, "**/*.ts"), join(root, "**/*.tsx")])
  swapCnImports(project, root)

  const files = project.getSourceFiles()
  const unmapped: UnmappedIcon[] = []
  const packages = new Set<string>()
  const graph = new Map<string, string[]>()
  const unresolved: string[] = []

  for (const file of files) {
    const path = file.getFilePath()
    const component = basename(path).replace(/\.tsx?$/, "")

    if (file.getFullText().includes("IconPlaceholder")) {
      throw new SyncError("installation", `The shadcn CLI left an icon placeholder in ${component}.`, true)
    }

    if (adapter) {
      unmapped.push(...applyAdapter(file, adapter, component))
    }

    const edges: string[] = []

    for (const declaration of [...file.getImportDeclarations(), ...file.getExportDeclarations()]) {
      const specifier = declaration.getModuleSpecifierValue()

      if (!specifier) {
        continue
      }

      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) {
        packages.add(packageName(specifier))
        continue
      }

      const target = localTarget(file, root, specifier)

      if (!target) {
        unresolved.push(`${specifier} in ${component}`)
        continue
      }

      edges.push(slashes(target))
      declaration.setModuleSpecifier(withJsExtension(path, target))
    }

    graph.set(slashes(path), edges)
  }

  if (unmapped.length > 0) {
    const list = unmapped.map(({ icon, component }) => `${icon}, used in ${component}`).join("\n")

    throw new SyncError(
      "installation",
      `"${adapterName}" can't map ${unmapped.length === 1 ? list : `these icons:\n${list}`}\nAdd the icon to the adapter, or pick another icon library.`,
      true
    )
  }

  if (unresolved.length > 0) {
    throw new SyncError("installation", `These imports don't resolve:\n${unresolved.join("\n")}`, true)
  }

  const rootPath = slashes(root)
  const isComponent = (path: string) => posix.dirname(path) === `${rootPath}/ui`

  const ownModules = (start: string) => {
    const seen = new Set<string>()

    const visit = (path: string) => {
      if (seen.has(path) || (path !== start && isComponent(path))) {
        return
      }

      seen.add(path)

      for (const next of graph.get(path) ?? []) {
        visit(next)
      }
    }

    visit(start)

    return [...seen].toSorted()
  }

  const components = files
    .filter((file) => isComponent(slashes(file.getFilePath())))
    .map((file) => {
      const path = slashes(file.getFilePath())

      return {
        name: basename(path).replace(/\.tsx?$/, ""),
        path: posix.relative(rootPath, path),
        ...exportsOf(file),
        modules: ownModules(path).map((entry) => posix.relative(rootPath, entry))
      }
    })
    .toSorted((a, b) => (a.name < b.name ? -1 : 1))

  const shared = files
    .filter((file) =>
      ["hooks", "lib"].some((folder) => posix.dirname(slashes(file.getFilePath())) === `${rootPath}/${folder}`)
    )
    .map((file) => ({ path: posix.relative(rootPath, slashes(file.getFilePath())), ...exportsOf(file) }))
    .toSorted((a, b) => (a.path < b.path ? -1 : 1))

  const candidates = new Map(
    files.map((file) => [posix.relative(rootPath, slashes(file.getFilePath())), literalWords(file)])
  )

  return { project, components, shared, packages: [...packages].toSorted(), candidates } satisfies PreparedSources
}

/** The stylesheet of a `hooks/` or `lib/` module, beside it: `lib/highlighter.css` for `lib/highlighter.tsx`. */
export function sharedStylesheet(path: string) {
  return path.replace(/\.tsx?$/, ".css")
}

/**
 * Imports the shared stylesheet and the module's own into each component module, and into each `hooks/` or `lib/`
 * module in `styled`, the ones whose classes compile to rules. The CSS belongs to the module that renders the classes:
 * a bundler that skips a side-effect-free re-export still keeps every import of a module whose exports are used.
 */
export function importStyles(prepared: PreparedSources, root: string, styled: ReadonlySet<string>) {
  const modules = [
    ...prepared.components.map((component) => ({
      path: component.path,
      stylesheet: `../components/${component.name}/styles.css`
    })),
    ...prepared.shared
      .filter((module) => styled.has(module.path))
      .map((module) => ({ path: module.path, stylesheet: `./${posix.basename(sharedStylesheet(module.path))}` }))
  ]

  for (const { path, stylesheet } of modules) {
    const file = prepared.project.getSourceFileOrThrow(join(root, path))
    const first = file.getStatements()[0]
    const directive = Node.isExpressionStatement(first) && Node.isStringLiteral(first.getExpression())

    file.insertImportDeclarations(directive ? 1 : 0, [
      { moduleSpecifier: "../shared.css" },
      { moduleSpecifier: stylesheet }
    ])
  }
}
