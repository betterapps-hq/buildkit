import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, relative, sep } from "node:path"
import { findPackage, readManifest } from "./resolve.js"

/** sync's own folder, from which its dependencies resolve under any layout. */
const syncRoot = dirname(createRequire(import.meta.url).resolve("../package.json"))

/** React and React DOM always come from the app, so the components and the app share one React. */
const appOnly = new Set(["react", "react-dom"])

function present(path: string) {
  try {
    lstatSync(path)

    return true
  } catch {
    return false
  }
}

function link(directory: string, name: string, target: string) {
  const path = join(directory, "node_modules", ...name.split("/"))

  if (present(path)) {
    return
  }

  mkdirSync(dirname(path), { recursive: true })
  // Junctions need no elevation on Windows and take an absolute target; elsewhere a relative link survives moves.
  symlinkSync(
    process.platform === "win32" ? target : relative(dirname(path), target).split(sep).join("/"),
    path,
    "junction"
  )
}

/**
 * Where each package resolves for the build: the app's copy when it has one, else sync's own. React and React DOM come
 * only from the app. With `withDependencies`, each package's own dependencies are added too, resolved from beside it:
 * the components' declarations can name their types, such as React Aria's `@react-types/shared`, without the
 * components importing them.
 */
export function packageTargets(
  names: readonly string[],
  appDirectory: string,
  withDependencies = false
): Map<string, string> {
  const targets = new Map<string, string>()

  for (const name of names) {
    const target = findPackage(name, appDirectory) ?? (appOnly.has(name) ? undefined : findPackage(name, syncRoot))

    if (target) {
      targets.set(name, target)
    }
  }

  if (!withDependencies) {
    return targets
  }

  const dependencies = new Map<string, string>()

  for (const target of targets.values()) {
    const beside = realpathSync(target)

    for (const name of Object.keys(readManifest(target).dependencies ?? {})) {
      const dependency =
        targets.has(name) || dependencies.has(name) || appOnly.has(name) ? undefined : findPackage(name, beside)

      if (dependency) {
        dependencies.set(name, dependency)
      }
    }
  }

  return new Map([...targets, ...dependencies])
}

/** Links every target into `directory/node_modules`, for a build folder outside the app that resolves nothing itself. */
export function linkAll(directory: string, targets: ReadonlyMap<string, string>) {
  for (const [name, target] of targets) {
    link(directory, name, target)
  }
}

/**
 * Whether `directory/node_modules` holds exactly the links `linkMissing` would make now: one for each package the app
 * can't resolve, pointing at an installed package, and none for a package the app has. An app that adds or drops a
 * package after a build changes which links the output needs.
 */
export function linksCurrent(directory: string, names: readonly string[], appDirectory: string): boolean {
  return names.every((name) => {
    if (appOnly.has(name)) {
      return true
    }

    const linked = existsSync(join(directory, "node_modules", ...name.split("/"), "package.json"))

    return linked !== Boolean(findPackage(name, appDirectory))
  })
}

/**
 * Links each target the app can't resolve into `directory/node_modules`. Under a strict layout, such as pnpm's isolated
 * `node_modules`, sync's dependencies aren't visible from the app, so the generated code couldn't import them. A package
 * the app resolves is left alone: Node finds the app's copy by walking up from `directory`, which is inside the app, so
 * the app and the components share one copy. Returns the packages it linked.
 */
export function linkMissing(directory: string, targets: ReadonlyMap<string, string>, appDirectory: string): string[] {
  return [...targets].flatMap(([name, target]) => {
    if (appOnly.has(name) || findPackage(name, appDirectory)) {
      return []
    }

    link(directory, name, target)

    return [name]
  })
}
