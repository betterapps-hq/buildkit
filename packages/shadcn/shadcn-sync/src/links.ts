import { existsSync, lstatSync, mkdirSync, symlinkSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, relative, sep } from "node:path"
import { findPackage } from "./resolve.js"

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
 * Links each package in `names` that the app can't resolve into `directory/node_modules`, from sync's own
 * dependencies. Under a strict layout, such as pnpm's isolated `node_modules`, sync's dependencies aren't visible from
 * the app, so the generated code couldn't import them. A package the app resolves is left alone: Node finds the app's
 * copy by walking up from `directory`, which is inside the app, so the app and the components share one copy. React
 * and React DOM are never linked. Returns the packages it linked.
 */
export function linkMissing(directory: string, names: readonly string[], appDirectory: string): string[] {
  return names.flatMap((name) => {
    const own = appOnly.has(name) || findPackage(name, appDirectory) ? undefined : findPackage(name, syncRoot)

    if (!own) {
      return []
    }

    link(directory, name, own)

    return [name]
  })
}

/**
 * Links every package in `names` into `directory/node_modules`, the app's copy when it has one and sync's otherwise,
 * for a build folder outside the app that resolves nothing by walking up. React and React DOM come only from the app.
 */
export function linkAll(directory: string, names: readonly string[], appDirectory: string) {
  for (const name of names) {
    const target = findPackage(name, appDirectory) ?? (appOnly.has(name) ? undefined : findPackage(name, syncRoot))

    if (target && existsSync(target)) {
      link(directory, name, target)
    }
  }
}
