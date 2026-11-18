# @buildkitgg/theme-core

Light, dark, and system theme selection in a plain store, with no React, no DOM access, and no shared global instance.
Bind it to any framework or component library, and add the optional browser entry point to follow the device setting and
save the user's choice.

```sh
pnpm add @buildkitgg/theme-core
```

```ts
import { createThemeStore } from "@buildkitgg/theme-core"

const theme = createThemeStore() // "system", resolving to "light" until the device setting is known
const unsubscribe = theme.subscribe(() => {
  console.log(theme.getSnapshot()) // { theme: "dark", resolvedTheme: "dark" }
})
theme.setTheme("dark")
unsubscribe()
```

`Theme` is `"system" | "light" | "dark"`, and `ResolvedTheme` is `"light" | "dark"`. `getSnapshot()` returns a frozen
`{ theme, resolvedTheme }` object whose identity changes only when a value changes. `isTheme(value)` checks whether an
unknown value is a `Theme`. The `ThemeStore`, `ThemeOptions`, and `ThemeSnapshot` types are exported too.

`defaultTheme` is the app's default, `"system"` unless you pass another, such as `"dark"` for a dark-first app.
`systemTheme` is what `"system"` resolves to on the server and before the device setting is known; it defaults to
`"light"`. `setSystemTheme` updates that input without overriding the user's explicit choice. `getServerSnapshot()`
always returns the snapshot from construction, so create a store per server request when defaults depend on the user.

`theme.reset()` clears the user's selection and returns to `defaultTheme`. That differs from `setTheme("system")`, which
records an explicit choice. Persistence is internal; the store exposes only the theme API.

## Optional browser integration

```ts
import { connectBrowserTheme } from "@buildkitgg/theme-core/browser"

const disconnect = connectBrowserTheme(theme, { storageKey: "my-app-theme" })
// Call disconnect() when the app unmounts.
```

Call it once per store when the app starts in the browser. It follows the device's `prefers-color-scheme` setting. With
a `storageKey`, it saves the user's choice to local storage and keeps it in sync across tabs; omit `storageKey` to keep
the choice in memory, or add `storage: "sessionStorage"` to keep it within a browser tab. The store must come from
`createThemeStore` or a Buildkit theme adapter; any other object throws. Without a browser, it does nothing.

A valid saved choice wins over the app default. Malformed JSON and values of the wrong type are ignored, and an unknown
theme string resolves to the app default. When the saved item is removed or storage is cleared, the store returns to the
app default. `reset()` removes the saved choice, and with local storage, other tabs follow. Storage failures leave the
store working in memory. The adapter applies no DOM classes or styling.

See the [maintenance guide](docs/README.md).
