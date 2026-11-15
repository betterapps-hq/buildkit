import { pathToFileURL } from "node:url"
import { Node, type SourceFile } from "ts-morph"
import * as z from "zod"
import type { ShadcnIconAdapter } from "./adapter.js"
import { SyncError } from "./errors.js"
import { findPackage, readManifest, resolveFile } from "./resolve.js"

const adapterSchema = z.object({
  package: z.string().min(1),
  styles: z.string().min(1).optional(),
  icons: z.record(
    z.string(),
    z.object({
      name: z.string().min(1),
      module: z.string().min(1),
      props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
    })
  )
})

/** An icon adapter read from the app, with the version that goes into the fingerprint. */
export interface LoadedAdapter {
  readonly name: string
  readonly version: string
  readonly adapter: ShadcnIconAdapter
}

/** Imports an icon adapter from the app's own dependencies. */
export async function loadAdapter(name: string, appDirectory: string): Promise<LoadedAdapter> {
  const directory = findPackage(name, appDirectory)

  if (!directory) {
    throw new SyncError(
      "dependency",
      `${name} isn't installed. Add it to this app's devDependencies, then install again.`
    )
  }

  const module: { readonly default?: object } = await import(
    pathToFileURL(resolveFile(name, appDirectory, ["import", "default"])).href
  )

  const parsed = adapterSchema.safeParse(module.default)

  if (!parsed.success) {
    throw new SyncError(
      "configuration",
      `${name} isn't an icon adapter: its default export doesn't match ShadcnIconAdapter.\n${z.prettifyError(parsed.error)}`
    )
  }

  return { name, version: readManifest(directory).version ?? "0.0.0", adapter: parsed.data }
}

/** A Lucide icon an adapter doesn't map, and the component that uses it. */
export interface UnmappedIcon {
  readonly icon: string
  readonly component: string
}

/**
 * Rewrites a file's `lucide-react` imports to the adapter's per-icon modules, keeping each local name, and passes the
 * adapter's props to every JSX use. Returns the icons it couldn't map.
 */
export function applyAdapter(file: SourceFile, adapter: ShadcnIconAdapter, component: string): UnmappedIcon[] {
  const unmapped: UnmappedIcon[] = []

  for (const declaration of file.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== "lucide-react") {
      continue
    }

    const replacements = declaration.getNamedImports().map((named) => ({
      lucide: named.getName(),
      local: named.getAliasNode()?.getText() ?? named.getName()
    }))

    const missing = replacements.filter(({ lucide }) => !Object.hasOwn(adapter.icons, lucide))

    unmapped.push(...missing.map(({ lucide }) => ({ icon: lucide, component })))

    if (declaration.getDefaultImport() || declaration.getNamespaceImport()) {
      unmapped.push({ icon: declaration.getText(), component })

      continue
    }

    if (missing.length > 0) {
      continue
    }

    const index = declaration.getChildIndex()

    declaration.remove()
    file.insertImportDeclarations(
      index,
      replacements.map(({ lucide, local }) => {
        const replacement = adapter.icons[lucide]

        if (!replacement) {
          throw new Error(`Unmapped ${lucide}`)
        }

        return {
          moduleSpecifier: replacement.module,
          namedImports: [replacement.name === local ? local : { name: replacement.name, alias: local }]
        }
      })
    )

    for (const { lucide, local } of replacements) {
      const props = adapter.icons[lucide]?.props

      if (props) {
        applyProps(file, local, props, component)
      }
    }
  }

  return unmapped
}

function applyProps(
  file: SourceFile,
  local: string,
  props: Readonly<Record<string, string | number | boolean>>,
  component: string
) {
  for (const identifier of file.getDescendants().filter(Node.isIdentifier)) {
    if (identifier.getText() !== local || Node.isImportSpecifier(identifier.getParent())) {
      continue
    }

    const element = identifier.getParent()

    if (!Node.isJsxOpeningElement(element) && !Node.isJsxSelfClosingElement(element)) {
      throw new SyncError(
        "installation",
        `${local} in ${component} isn't rendered as JSX, so the icon adapter's props can't be passed to it.`
      )
    }

    const present = new Set(element.getAttributes().map((attribute) => attribute.getText().split("=")[0]))

    element.addAttributes(
      Object.entries(props)
        .filter(([name]) => !present.has(name))
        .map(([name, value]) => ({
          name,
          initializer: JSON.stringify(value).startsWith('"') ? JSON.stringify(value) : `{${JSON.stringify(value)}}`
        }))
    )
  }
}
