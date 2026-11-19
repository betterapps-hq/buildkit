import { createThemeStore, type ThemeDefinition, type ThemeOptions, type ThemeStore } from "@buildkitgg/theme-core"
import {
  connectBrowserTheme,
  getThemeInitScript as getCoreThemeInitScript,
  type ThemeClasses,
  type ThemeElementOptions,
  type ThemeElementTarget,
  type ThemeStorageOptions
} from "@buildkitgg/theme-core/browser"

export { useTheme, type UseThemeResult } from "@buildkitgg/react-theme"

/** A shadcn theme is the classes that switch its CSS variables, plus the color scheme underneath. */
export type ShadcnThemeDefinition = ThemeDefinition & { readonly classes: readonly string[] }

export type ShadcnThemeDefinitions = { readonly [name: string]: ShadcnThemeDefinition }

/** shadcn's own convention: `.dark` for dark, and no class for light. */
export type DefaultShadcnThemes = {
  readonly light: { readonly scheme: "light"; readonly classes: readonly [] }
  readonly dark: { readonly scheme: "dark"; readonly classes: readonly ["dark"] }
}

/** Where the theme is marked. The classes come from each theme. */
export type ShadcnThemeElementOptions = {
  /** Defaults to `"html"`. */
  target?: ThemeElementTarget
  /** Also writes the theme name to this attribute, such as `"data-theme"`, and follows changes to it. */
  attribute?: string
  /** Sets the element's `color-scheme`. Defaults to true. */
  colorScheme?: boolean
}

export type ShadcnThemeOptions<T extends ShadcnThemeDefinitions = DefaultShadcnThemes> = ThemeOptions<T> &
  ThemeStorageOptions &
  ShadcnThemeElementOptions & { window?: Window }

export type ShadcnThemeStore<T extends ShadcnThemeDefinitions = DefaultShadcnThemes> = ThemeStore<T> & {
  start(): () => void
}

export type ThemeInitScriptOptions<T extends ShadcnThemeDefinitions = DefaultShadcnThemes> = Omit<
  ThemeOptions<T>,
  "systemTheme"
> &
  ThemeStorageOptions &
  ShadcnThemeElementOptions

export type {
  ColorScheme,
  Theme,
  ThemeName,
  ResolvedTheme,
  SystemThemes,
  ThemeSnapshot,
  ThemesOfScheme
} from "@buildkitgg/theme-core"

const DEFAULT_THEMES: DefaultShadcnThemes = {
  light: { scheme: "light", classes: [] },
  dark: { scheme: "dark", classes: ["dark"] }
}

/** The element binding for a set of shadcn themes: each theme's classes, on the chosen element. */
function elementOptions<T extends ShadcnThemeDefinitions>(
  themes: ShadcnThemeDefinitions,
  { target, attribute, colorScheme }: ShadcnThemeElementOptions
): ThemeElementOptions<T> {
  const classes = Object.fromEntries(Object.entries(themes).map(([name, theme]) => [name, theme.classes]))

  // SAFETY: the entries come from the store's own themes, which T describes, so every theme has its classes.
  return { target, attribute, colorScheme, classes: classes as ThemeClasses<T> }
}

/**
 * Construct safely on the server; start only at the browser application boundary. Starting binds the theme to the
 * element in both directions, so code outside React that changes the classes changes the theme too.
 */
export function createShadcnTheme<const T extends ShadcnThemeDefinitions = DefaultShadcnThemes>(
  options?: ShadcnThemeOptions<T>
): ShadcnThemeStore<T> {
  const themes: ShadcnThemeDefinitions = options?.themes ?? DEFAULT_THEMES
  // SAFETY: without declared themes, T defaults to DefaultShadcnThemes, which DEFAULT_THEMES is.
  const store = createThemeStore<T>({ ...options, themes } as ThemeOptions<T>)
  let stop: (() => void) | undefined
  let owners = 0

  function start() {
    const browser = options?.window ?? (typeof window === "undefined" ? undefined : window)

    if (!browser) {
      return () => {
        /* Nothing to disconnect on the server. */
      }
    }

    stop ??= connectBrowserTheme(store, {
      // SAFETY: the store options include the storage options, which connectBrowserTheme validates.
      ...(options as ThemeStorageOptions),
      window: browser,
      element: elementOptions<T>(themes, options ?? {})
    })

    owners++
    let isStopped = false

    return () => {
      if (isStopped) {
        return
      }

      isStopped = true

      if (--owners === 0) {
        stop?.()
        stop = undefined
      }
    }
  }

  return { ...store, start }
}

/** Put this trusted script before first paint, with the same options as the store; pass your CSP nonce on the tag. */
export function getThemeInitScript<const T extends ShadcnThemeDefinitions = DefaultShadcnThemes>(
  options?: ThemeInitScriptOptions<T>
) {
  const { target, attribute, colorScheme, ...rest } = options ?? {}
  const themes: ShadcnThemeDefinitions = options?.themes ?? DEFAULT_THEMES
  const element = elementOptions<T>(themes, { target, attribute, colorScheme })

  // SAFETY: the same options as the store, with the theme classes as the element binding; without declared themes,
  // T defaults to DefaultShadcnThemes, which DEFAULT_THEMES is.
  return getCoreThemeInitScript<T>({ ...rest, themes, element } as Parameters<typeof getCoreThemeInitScript<T>>[0])
}
