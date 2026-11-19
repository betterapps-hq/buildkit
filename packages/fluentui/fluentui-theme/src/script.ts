import {
  getThemeInitScript as getCoreThemeInitScript,
  type ThemeElementOptions,
  type ThemeInitScriptOptions as CoreThemeInitScriptOptions
} from "@buildkitgg/theme-core/browser"
import type { DefaultFluentThemes, FluentThemeDefinitions } from "./createFluentTheme.js"

export type { DefaultFluentThemes, FluentThemeDefinitions } from "./createFluentTheme.js"

/** The store's themes, system pair and storage, plus the `element` binding the script applies before first paint. */
export type ThemeInitScriptOptions<T extends FluentThemeDefinitions = DefaultFluentThemes> = Omit<
  CoreThemeInitScriptOptions<T>,
  "element"
> & { element: ThemeElementOptions<T> }

/**
 * For stores with an `element` binding: marks the element with the saved theme before first paint, so CSS-first code
 * doesn't flash the default theme. Lives in its own entry point so server code can import it without the client
 * components. Pass the store's options and your CSP nonce on the script tag.
 */
export function getThemeInitScript<const T extends FluentThemeDefinitions = DefaultFluentThemes>(
  options: ThemeInitScriptOptions<T>
) {
  // SAFETY: the options only add the required element to what the core script takes.
  return getCoreThemeInitScript<T>(options as CoreThemeInitScriptOptions<T>)
}
