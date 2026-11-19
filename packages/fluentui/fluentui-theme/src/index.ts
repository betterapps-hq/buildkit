"use client"

export {
  createFluentTheme,
  type DefaultFluentThemes,
  type FluentThemeDefinition,
  type FluentThemeDefinitions,
  type FluentThemeOptions,
  type FluentThemeStore
} from "./createFluentTheme.js"

export { FluentThemeProvider, type FluentThemeProviderProps } from "./FluentThemeProvider.js"

export { useTheme, type UseThemeResult } from "@buildkitgg/react-theme"

export type { ThemeElementOptions, ThemeElementTarget, ThemeClasses } from "@buildkitgg/theme-core/browser"

export type {
  Theme as ThemeSelection,
  ColorScheme,
  ThemeName,
  ResolvedTheme,
  SystemThemes,
  ThemeSnapshot,
  ThemesOfScheme
} from "@buildkitgg/theme-core"
