"use client"

import { useTheme } from "@buildkitgg/react-theme"
import { FluentProvider, type FluentProviderProps } from "@fluentui/react-components"
import { useEffect } from "react"
import type { DefaultFluentThemes, FluentThemeDefinitions, FluentThemeStore } from "./createFluentTheme.js"

export type FluentThemeProviderProps<T extends FluentThemeDefinitions = DefaultFluentThemes> = Omit<
  FluentProviderProps,
  "theme"
> & { store: FluentThemeStore<T> }

/** Retains Fluent's native context and portal support; selection lives in the external store. */
export function FluentThemeProvider<T extends FluentThemeDefinitions>({
  store,
  ...props
}: FluentThemeProviderProps<T>) {
  const { resolvedTheme } = useTheme(store)
  useEffect(() => store.start(), [store])

  return <FluentProvider {...props} theme={store.themes[resolvedTheme]} />
}
