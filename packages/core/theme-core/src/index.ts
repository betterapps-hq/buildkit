import { createPreferences } from "@buildkitgg/preferences-core"
import { themeInternals, type ThemePreferences } from "./internal.js"

/** The color scheme underneath a theme, which drives the CSS `color-scheme` property. */
export type ColorScheme = "light" | "dark"

/** What every theme declares. Adapters add their own fields, such as CSS classes or a component library's theme. */
export type ThemeDefinition = { readonly scheme: ColorScheme }

export type ThemeDefinitions = { readonly [name: string]: ThemeDefinition }

/** The themes a store has when the app declares none. */
export type DefaultThemes = { readonly light: { readonly scheme: "light" }; readonly dark: { readonly scheme: "dark" } }

export type ThemeName<T extends ThemeDefinitions = DefaultThemes> = Extract<keyof T, string>

/** A theme the user can choose: one of the declared names, or `"system"` to follow the device. */
export type Theme<T extends ThemeDefinitions = DefaultThemes> = ThemeName<T> | "system"

/** The declared theme in effect once `"system"` is resolved. */
export type ResolvedTheme<T extends ThemeDefinitions = DefaultThemes> = ThemeName<T>

/** Names of the declared themes whose scheme is `S`. */
export type ThemesOfScheme<T extends ThemeDefinitions, S extends ColorScheme> = {
  [K in ThemeName<T>]: S extends T[K]["scheme"] ? K : never
}[ThemeName<T>]

/** The themes `"system"` resolves to when the device prefers light or dark. */
export type SystemThemes<T extends ThemeDefinitions = DefaultThemes> = Readonly<{
  light: ThemesOfScheme<T, "light">
  dark: ThemesOfScheme<T, "dark">
}>

export type ThemeSnapshot<T extends ThemeDefinitions = DefaultThemes> = Readonly<{
  theme: Theme<T>
  resolvedTheme: ResolvedTheme<T>
  colorScheme: ColorScheme
  systemThemes: SystemThemes<T>
}>

/** True when `T` has a light theme named `light` and a dark theme named `dark`, which then make the default pair. */
type HasDefaultPair<T extends ThemeDefinitions> = T extends {
  readonly light: { readonly scheme: "light" }
  readonly dark: { readonly scheme: "dark" }
}
  ? true
  : false

export type ThemeOptions<T extends ThemeDefinitions = DefaultThemes> = {
  /** The themes users can choose from. Defaults to `light` and `dark`. */
  themes?: T
  defaultTheme?: NoInfer<Theme<T>>
  /** What the device prefers on the server and before the browser reports it. */
  systemTheme?: ColorScheme
} & (HasDefaultPair<T> extends true
  ? { /** Defaults to the `light` and `dark` themes. */ system?: NoInfer<SystemThemes<T>> }
  : { system: NoInfer<SystemThemes<T>> })

export type ThemeStore<T extends ThemeDefinitions = DefaultThemes> = {
  reset(): void
  getSnapshot(): ThemeSnapshot<T>
  getServerSnapshot(): ThemeSnapshot<T>
  subscribe(listener: () => void): () => void
  setTheme(theme: Theme<T>): void
  /** Changes the themes `"system"` follows, such as a theme family's light and dark versions. */
  setSystemThemes(themes: SystemThemes<T>): void
  /** Reports what the device prefers. The browser entry point calls this for you. */
  setSystemTheme(scheme: ColorScheme): void
  /** Narrows an unknown value, such as a URL parameter, to one of this store's themes or `"system"`. */
  isTheme(value: unknown): value is Theme<T>
}

const DEFAULT_THEMES: DefaultThemes = { light: { scheme: "light" }, dark: { scheme: "dark" } }

/** Checks for the default themes. A store's `isTheme` also accepts the themes it declares. */
export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}

function isScheme(value: unknown): value is ColorScheme {
  return value === "light" || value === "dark"
}

/** Validates declared themes, since JavaScript callers and JSON configuration skip the types. */
function readThemes(themes: ThemeDefinitions) {
  const names = Object.keys(themes)

  if (names.length === 0) {
    throw new TypeError("Declare at least one theme")
  }

  for (const name of names) {
    if (!name.length || name === "system") {
      throw new TypeError(`Invalid theme name: ${JSON.stringify(name)}`)
    }

    if (!isScheme(themes[name]?.scheme)) {
      throw new TypeError(`Theme ${name} needs a scheme of light or dark`)
    }
  }

  return new Map(names.map((name) => [name, themes[name]!.scheme]))
}

/** Creates isolated state. No browser effects or process-wide singleton. */
export function createThemeStore<const T extends ThemeDefinitions = DefaultThemes>(
  options?: ThemeOptions<T>
): ThemeStore<T> {
  const schemes = readThemes(options?.themes ?? DEFAULT_THEMES)
  const choices = new Set<unknown>(["system", ...schemes.keys()])
  const defaultTheme: string = options?.defaultTheme ?? "system"

  /** Whether a name from configuration or storage is a declared theme with this scheme. */
  const hasScheme = (name: string | undefined, scheme: ColorScheme): name is string =>
    name !== undefined && schemes.get(name) === scheme

  if (!choices.has(defaultTheme)) {
    throw new TypeError("Unknown default theme")
  }

  if (options?.systemTheme !== undefined && !isScheme(options.systemTheme)) {
    throw new TypeError("Unknown system theme")
  }

  const defaultPair: { light?: string; dark?: string } = options?.system ?? { light: "light", dark: "dark" }

  if (!hasScheme(defaultPair.light, "light") || !hasScheme(defaultPair.dark, "dark")) {
    throw new TypeError(
      options?.system
        ? "The system pair needs a declared light theme and a declared dark theme"
        : "Themes without a light theme named light and a dark theme named dark need a system pair"
    )
  }

  const pair = { light: defaultPair.light, dark: defaultPair.dark }
  let system: ColorScheme = options?.systemTheme ?? "light"

  const preferences = createPreferences<ThemePreferences>({
    defaults: { theme: defaultTheme, systemLight: pair.light, systemDark: pair.dark }
  })

  function resolve(): ThemeSnapshot<T> {
    const preference = preferences.get("theme")
    const light = preferences.get("systemLight")
    const dark = preferences.get("systemDark")
    const theme = choices.has(preference) && preference !== undefined ? preference : defaultTheme

    const systemThemes = Object.freeze({
      light: hasScheme(light, "light") ? light : pair.light,
      dark: hasScheme(dark, "dark") ? dark : pair.dark
    })

    const resolvedTheme = theme === "system" ? systemThemes[system] : theme
    const colorScheme = schemes.get(resolvedTheme) ?? "light"

    // SAFETY: every name was checked against the declared themes above, and T describes those themes.
    return Object.freeze({ theme, resolvedTheme, colorScheme, systemThemes }) as ThemeSnapshot<T>
  }

  let snapshot = resolve()
  const serverSnapshot = snapshot
  const listeners = new Set<() => void>()

  function update() {
    const next = resolve()

    if (
      snapshot.theme === next.theme &&
      snapshot.resolvedTheme === next.resolvedTheme &&
      snapshot.systemThemes.light === next.systemThemes.light &&
      snapshot.systemThemes.dark === next.systemThemes.dark
    ) {
      return
    }

    snapshot = next
    const currentListeners = [...listeners]

    for (const listener of currentListeners) {
      listener()
    }
  }

  preferences.subscribe(update)

  const store: ThemeStore<T> = {
    reset() {
      preferences.resetAll()
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    setTheme(theme) {
      // JavaScript callers skip the types, so the name is checked here too
      if (!choices.has(theme)) {
        throw new TypeError("Unknown theme preference")
      }

      preferences.set("theme", theme)
    },
    setSystemThemes(themes) {
      if (!hasScheme(themes?.light, "light") || !hasScheme(themes.dark, "dark")) {
        throw new TypeError("The system pair needs a declared light theme and a declared dark theme")
      }

      // One import updates both themes in a single change, so listeners never see half a pair
      preferences.importJson(JSON.stringify({ systemLight: themes.light, systemDark: themes.dark }))
    },
    setSystemTheme(scheme) {
      if (!isScheme(scheme)) {
        throw new TypeError("Unknown system theme")
      }

      system = scheme
      update()
    },
    isTheme: (value): value is Theme<T> => choices.has(value)
  }

  themeInternals.set(store.getSnapshot, { preferences, schemes })

  return store
}
