import { SyncError } from "./errors.js"

export const bases = ["base-ui", "radix"] as const
export const styles = ["nova", "vega", "luma", "lyra", "maia", "mira", "rhea", "sera"] as const
export const cssModes = ["compiled", "tailwind"] as const

/** The icon libraries the registry's `IconPlaceholder` carries names for, so the shadcn CLI applies them itself. */
export const builtInIcons = ["lucide", "tabler", "hugeicons", "phosphor", "remixicon"] as const

export type Base = (typeof bases)[number]

export type Style = (typeof styles)[number]

export type CssMode = (typeof cssModes)[number]

/** The settings an app picks in its `postinstall`. */
export interface SyncSettings {
  readonly base: Base
  /** A built-in icon library id, or the package name of an icon adapter. */
  readonly icons: string
  readonly style: Style
  readonly theme: string
  readonly css: CssMode
}

export const defaultSettings: SyncSettings = {
  base: "base-ui",
  icons: "lucide",
  style: "nova",
  theme: "neutral",
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
  const theme = flags.theme ?? base.theme
  const icons = flags.icons ?? base.icons

  if (!/^[a-z0-9-]+$/.test(theme)) {
    throw new SyncError("configuration", `--theme ${theme} isn't a registry theme name.`)
  }

  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(icons)) {
    throw new SyncError("configuration", `--icons ${icons} isn't an icon library id or a package name.`)
  }

  const settings: SyncSettings = {
    base: pick("base", flags.base ?? base.base, bases),
    icons,
    style: pick("style", flags.style ?? base.style, styles),
    theme,
    css: pick("css", flags.css ?? base.css, cssModes)
  }

  if (settings.css === "tailwind") {
    throw new SyncError("configuration", "--css tailwind isn't available yet. Use --css compiled.")
  }

  return settings
}

/** The registry style that holds the items for a base and style, such as `base-nova` or `radix-vega`. */
export function registryStyle(settings: SyncSettings): string {
  return `${settings.base === "base-ui" ? "base" : "radix"}-${settings.style}`
}

export function isBuiltInIcons(icons: string): boolean {
  return builtInIcons.some((library) => library === icons)
}
