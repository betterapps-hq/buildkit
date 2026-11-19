import type { PreferencesStore } from "@buildkitgg/preferences-core"
import type { ColorScheme } from "./index.js"

/** What a theme store saves: the user's choice and the pair `"system"` follows, by theme name. */
export type ThemePreferences = { theme: string; systemLight: string; systemDark: string }

export type ThemeInternals = {
  preferences: PreferencesStore<ThemePreferences>
  /** Every declared theme and its color scheme. */
  schemes: ReadonlyMap<string, ColorScheme>
}

// Key by the stable snapshot function so adapters can wrap the public store.
export const themeInternals = new WeakMap<object, ThemeInternals>()

/** Whether the user has saved a theme choice, as opposed to the store showing its default. */
export function hasSavedTheme(preferences: PreferencesStore<ThemePreferences>) {
  return Object.hasOwn(JSON.parse(preferences.exportJson()), "theme")
}
