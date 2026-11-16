import { iconLibraries } from "shadcn/icons"
import { DEFAULT_PRESET_CONFIG, PRESET_BASE_COLORS, PRESET_BASES, PRESET_STYLES } from "shadcn/preset"
import { SyncError } from "./errors.js"

// The choices come from the pinned shadcn CLI's own data, so they follow upstream when the shadcn version changes.
export const bases: readonly string[] = PRESET_BASES
export const styles: readonly string[] = PRESET_STYLES
export const themes: readonly string[] = PRESET_BASE_COLORS
export const cssModes = ["compiled", "tailwind"] as const

/** The icon libraries the shadcn CLI applies itself, with their titles and the packages their imports need. */
export const builtInIcons: ReadonlyMap<string, { readonly title: string; readonly packages: readonly string[] }> =
  new Map(Object.values(iconLibraries).map((library) => [library.name, library]))

/**
 * What shadcn's data doesn't say about each base: its name, and the primitives package its components import. A base
 * missing here still works, shown by its id; sync then finds its package when it checks the build's imports.
 */
const baseDetails = new Map([
  ["base", { title: "Base UI", package: "@base-ui/react" }],
  ["radix", { title: "Radix", package: "radix-ui" }],
  ["aria", { title: "React Aria", package: "react-aria-components" }]
])

export function baseTitle(base: string): string {
  return baseDetails.get(base)?.title ?? base
}

export function basePackage(base: string): string | undefined {
  return baseDetails.get(base)?.package
}

/** A registry id as shadcn shows it, such as `nova` as Nova. */
export function titleCase(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1)
}

export type CssMode = (typeof cssModes)[number]

/** The settings an app picks in its `postinstall`. */
export interface SyncSettings {
  /** A shadcn base: `base` (Base UI), `radix` or `aria` (React Aria). */
  readonly base: string
  /** A built-in icon library id, or the package name of an icon adapter. */
  readonly icons: string
  readonly style: string
  readonly theme: string
  readonly css: CssMode
}

export const defaultSettings: SyncSettings = {
  base: "base",
  icons: DEFAULT_PRESET_CONFIG.iconLibrary,
  style: DEFAULT_PRESET_CONFIG.style,
  theme: DEFAULT_PRESET_CONFIG.baseColor,
  css: "compiled"
}

/** Raw flag values as citty parses them; anything missing takes its default. */
export interface SettingFlags {
  readonly base?: string | undefined
  readonly icons?: string | undefined
  readonly style?: string | undefined
  readonly theme?: string | undefined
  readonly css?: string | undefined
}

export const settingKeys = ["base", "icons", "style", "theme", "css"] as const

/** Whether any setting flag was given. */
export function hasSettingFlags(flags: SettingFlags): boolean {
  return settingKeys.some((key) => flags[key] !== undefined)
}

function pick<Value extends string>(flag: string, value: string, allowed: readonly Value[]): Value {
  const match = allowed.find((entry) => entry === value)

  if (!match) {
    throw new SyncError(
      "configuration",
      `--${flag} ${value} isn't valid. Use ${new Intl.ListFormat("en", { type: "disjunction" }).format(allowed)}.`
    )
  }

  return match
}

export function parseSettings(flags: SettingFlags, base: SyncSettings = defaultSettings): SyncSettings {
  const icons = flags.icons ?? base.icons

  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(icons)) {
    throw new SyncError("configuration", `--icons ${icons} isn't an icon library id or a package name.`)
  }

  const settings: SyncSettings = {
    base: pick("base", flags.base ?? base.base, bases),
    icons,
    style: pick("style", flags.style ?? base.style, styles),
    theme: pick("theme", flags.theme ?? base.theme, themes),
    css: pick("css", flags.css ?? base.css, cssModes)
  }

  if (settings.css === "tailwind") {
    throw new SyncError("configuration", "--css tailwind isn't available yet. Use --css compiled.")
  }

  return settings
}

/** The registry style that holds the items for a base and style, such as `base-nova` or `radix-vega`. */
export function registryStyle(settings: SyncSettings): string {
  return `${settings.base}-${settings.style}`
}

export function isBuiltInIcons(icons: string): boolean {
  return builtInIcons.has(icons)
}
