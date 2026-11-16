import { join, posix, relative, sep } from "node:path"
import { Node, type Project } from "ts-morph"
import { SyncError } from "./errors.js"

/** The module every generated module imports `cn` from, under `src/`. */
export const cnModule = "lib/utils.ts"

/** The `cn` module sync writes: shadcn's compiled merger, replaceable at runtime with `setCn`. */
export const cnSource = `import { cn as compiledCn, type ClassValue, type CnFunction } from "cn"

let merge: CnFunction = compiledCn

/** Joins class names and resolves Tailwind conflicts, with shadcn's merger unless \`setCn\` replaced it. */
export function cn(...inputs: ClassValue[]): string {
  return merge(...inputs)
}

/** Replaces the class merger every component uses, such as one from \`createCn\` that knows the app's theme. */
export function setCn(next: CnFunction) {
  merge = next
}
`

/**
 * Writes the swappable `cn` module and points every other module's `cn` import at it, so `setCn` changes how every
 * component merges classes. Fails on an import of anything else from `cn`, which the module doesn't re-export.
 */
export function swapCnImports(project: Project, root: string) {
  const target = join(root, cnModule)
  const module = project.getSourceFile(target) ?? project.createSourceFile(target)

  module.replaceWithText(cnSource)

  for (const file of project.getSourceFiles()) {
    if (file === module) {
      continue
    }

    const from = relative(root, file.getFilePath()).split(sep).join("/")

    for (const declaration of [...file.getImportDeclarations(), ...file.getExportDeclarations()]) {
      if (declaration.getModuleSpecifierValue() !== "cn") {
        continue
      }

      const imported = Node.isImportDeclaration(declaration)
      const names = imported ? declaration.getNamedImports() : declaration.getNamedExports()

      const whole = imported
        ? Boolean(declaration.getDefaultImport() ?? declaration.getNamespaceImport())
        : declaration.isNamespaceExport()

      if (whole || names.length === 0 || names.some((named) => named.getName() !== "cn")) {
        throw new SyncError("installation", `${from} imports more than cn from "cn": ${declaration.getText()}`, true)
      }

      const path = posix.relative(posix.dirname(from), cnModule.replace(/\.ts$/, ""))

      declaration.setModuleSpecifier(path.startsWith(".") ? path : `./${path}`)
    }
  }
}
