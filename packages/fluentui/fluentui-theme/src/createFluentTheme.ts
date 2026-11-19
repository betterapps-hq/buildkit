import {
  createThemeStore,
  type ThemeDefinition,
  type ThemeName,
  type ThemeOptions,
  type ThemeStore
} from "@buildkitgg/theme-core"
import { connectBrowserTheme, type BrowserThemeOptions } from "@buildkitgg/theme-core/browser"
import { webLightTheme, webDarkTheme, type Theme } from "@fluentui/react-components"

/** A theme users can choose: a complete Fluent theme, plus the color scheme underneath it. */
export type FluentThemeDefinition = ThemeDefinition & { readonly theme: Theme }

export type FluentThemeDefinitions = { readonly [name: string]: FluentThemeDefinition }

export type DefaultFluentThemes = {
  readonly light: { readonly scheme: "light"; readonly theme: Theme }
  readonly dark: { readonly scheme: "dark"; readonly theme: Theme }
}

/** `lightTheme` and `darkTheme` customize the default themes. Declared themes carry their own Fluent themes. */
type FluentThemeSources<T extends FluentThemeDefinitions> = [ThemeName<T>] extends ["light" | "dark"]
  ? { lightTheme?: Theme; darkTheme?: Theme }
  : { lightTheme?: never; darkTheme?: never }

export type FluentThemeOptions<T extends FluentThemeDefinitions = DefaultFluentThemes> = ThemeOptions<T> &
  BrowserThemeOptions<T> &
  FluentThemeSources<T>

export type FluentThemeStore<T extends FluentThemeDefinitions = DefaultFluentThemes> = ThemeStore<T> & {
  /** The Fluent theme for each theme name. */
  readonly themes: Readonly<{ [K in ThemeName<T>]: Theme }>
  start(): () => void
}

/** State is usable outside React. Browser effects start explicitly or on provider mount. */
export function createFluentTheme<const T extends FluentThemeDefinitions = DefaultFluentThemes>(
  options?: FluentThemeOptions<T>
): FluentThemeStore<T> {
  // SAFETY: lightTheme and darkTheme are optional on every FluentThemeOptions; declared themes type them as never.
  const { lightTheme, darkTheme } = (options ?? {}) as { lightTheme?: Theme; darkTheme?: Theme }

  if (options?.themes && (lightTheme || darkTheme)) {
    throw new TypeError("Pass lightTheme and darkTheme only with the default themes")
  }

  const definitions: FluentThemeDefinitions = options?.themes ?? {
    light: { scheme: "light", theme: lightTheme ?? webLightTheme },
    dark: { scheme: "dark", theme: darkTheme ?? webDarkTheme }
  }

  for (const [name, definition] of Object.entries(definitions)) {
    if (!(definition?.theme instanceof Object)) {
      throw new TypeError(`Theme ${name} needs a Fluent theme`)
    }
  }

  // SAFETY: without declared themes, the definitions above are DefaultFluentThemes, which T defaults to.
  const store = createThemeStore<T>({ ...options, themes: definitions } as ThemeOptions<T>)

  const entries = Object.entries(definitions).map(([name, definition]) => [name, definition.theme])
  // SAFETY: the entries come from the store's own themes, which T describes, so every theme has its Fluent theme.
  const themes = Object.freeze(Object.fromEntries(entries)) as FluentThemeStore<T>["themes"]

  let disconnect: (() => void) | undefined
  let owners = 0

  function start() {
    const browser = options?.window ?? (typeof window === "undefined" ? undefined : window)

    if (!browser) {
      return () => {
        /* No browser effects during server rendering. */
      }
    }

    // SAFETY: FluentThemeOptions<T> includes BrowserThemeOptions<T>, which connectBrowserTheme validates.
    disconnect ??= connectBrowserTheme(store, { ...(options as BrowserThemeOptions<T>), window: browser })
    owners++
    let isStopped = false

    return () => {
      if (isStopped) {
        return
      }

      isStopped = true

      if (--owners === 0) {
        disconnect?.()
        disconnect = undefined
      }
    }
  }

  return { ...store, themes, start }
}
