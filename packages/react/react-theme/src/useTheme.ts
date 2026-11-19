"use client"

import type { DefaultThemes, ThemeDefinitions, ThemeSnapshot, ThemeStore } from "@buildkitgg/theme-core"
import { useSyncExternalStore } from "react"

/** Subscribes to the same store used by non-React callers. No provider needed. */
export type UseThemeResult<T extends ThemeDefinitions = DefaultThemes> = ThemeSnapshot<T> &
  Pick<ThemeStore<T>, "setTheme" | "setSystemThemes" | "reset" | "isTheme">

export function useTheme<T extends ThemeDefinitions>(store: ThemeStore<T>): UseThemeResult<T> {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)

  return {
    ...snapshot,
    setTheme: store.setTheme,
    setSystemThemes: store.setSystemThemes,
    reset: store.reset,
    isTheme: store.isTheme
  }
}
