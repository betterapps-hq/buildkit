# @buildkitgg/theme-core

Light, dark, and system theme selection in a plain store, with no React and no shared global instance. Declare your own
themes, such as a family's light, dark, and high-contrast versions. Bind the store to any framework or component
library, and add the optional browser entry point to follow the device setting, save the user's choice, and keep a class
or attribute on the page in step with the store.

```sh
pnpm add @buildkitgg/theme-core
```

```ts
import { createThemeStore } from "@buildkitgg/theme-core"

const theme = createThemeStore() // "system", resolving to "light" until the device setting is known
const unsubscribe = theme.subscribe(() => {
  console.log(theme.getSnapshot()) // { theme: "dark", resolvedTheme: "dark", colorScheme: "dark", ... }
})
theme.setTheme("dark")
unsubscribe()
```

Without declared themes, `Theme` is `"system" | "light" | "dark"`, and `ResolvedTheme` is `"light" | "dark"`.
`getSnapshot()` returns a frozen `{ theme, resolvedTheme, colorScheme, systemThemes }` object whose identity changes
only when a value changes. `theme.isTheme(value)` narrows an unknown value, such as a URL parameter, to one of the
store's themes or `"system"`; the exported `isTheme` checks the default themes.

`defaultTheme` is the app's default, `"system"` unless you pass another, such as `"dark"` for a dark-first app.
`systemTheme` is what the device is assumed to prefer on the server and before the browser reports it; it defaults to
`"light"`. `setSystemTheme` updates that input without overriding the user's explicit choice. `getServerSnapshot()`
always returns the snapshot from construction, so create a store per server request when defaults depend on the user.

`theme.reset()` clears the user's selection and returns to `defaultTheme`. That differs from `setTheme("system")`, which
records an explicit choice. Persistence is internal; the store exposes only the theme API.

## Named themes

Declare the themes users choose from, each with the color scheme underneath it. Every API then takes and returns those
names, and a typo is a compile error:

```ts
const theme = createThemeStore({
  themes: {
    "fluent-light": { scheme: "light" },
    "fluent-dark": { scheme: "dark" },
    "teams-light": { scheme: "light" },
    "teams-dark": { scheme: "dark" },
    "teams-contrast": { scheme: "dark" }
  },
  system: { light: "fluent-light", dark: "fluent-dark" }
})

theme.setTheme("teams-contrast")
theme.setSystemThemes({ light: "teams-light", dark: "teams-dark" }) // Teams, following the device
```

`"system"` resolves through the `system` pair: its light theme when the device prefers light, and its dark theme when it
prefers dark. The light slot only accepts themes declared `scheme: "light"`, and the dark slot only dark ones. `system`
is optional when you declare a light theme named `light` and a dark theme named `dark`, and required otherwise.
`setSystemThemes` changes the pair, and the store saves it with the user's choice; `reset()` restores both.

The snapshot's `colorScheme` is the resolved theme's scheme, for the CSS `color-scheme` property and for code that only
cares about light versus dark. To name the themes elsewhere, declare them in a constant
(`const themes = { ... } as const`) and use `ThemeName<typeof themes>`, `ThemesOfScheme<typeof themes, "dark">`, or
`SystemThemes<typeof themes>`.

A saved theme or pair that's no longer declared, after you remove a theme, falls back to the app default.

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
store working in memory.

## Binding to the page

Without an `element` option, the store never reads or changes the document. With one, it keeps a class or attribute on
`<html>` or `<body>` in step with the store, in both directions:

```ts
connectBrowserTheme(theme, { storageKey: "my-app-theme", element: {} }) // .dark on <html> for dark, no class for light
```

When the theme changes, the element is marked with it, so CSS-first code that styles `.dark` follows. When other code
changes the element, such as a script or another library with its own theme toggle, the store follows: components that
read the store update, and so does anything subscribed outside React.

| Option        | Default   | What it does                                                                        |
| ------------- | --------- | ----------------------------------------------------------------------------------- |
| `target`      | `"html"`  | `"html"` or `"body"`                                                                |
| `classes`     | see below | The classes each theme puts on the element                                          |
| `attribute`   | none      | An attribute whose value is the theme name, such as `"data-theme"`                  |
| `colorScheme` | `true`    | Sets the element's `color-scheme` to the theme's scheme                             |
| `read`        | `true`    | Follows changes other code makes to the element                                     |
| `write`       | `true`    | Marks the element with the current theme, and restores what was there on disconnect |

With the default themes, leaving out `classes` and `attribute` means `.dark` for dark and no class for light. Declared
themes need one of them. A theme can list several classes, so a family keeps your existing `.dark` styles under each of
its dark themes:

```ts
connectBrowserTheme(theme, {
  element: {
    classes: {
      "fluent-light": [],
      "fluent-dark": ["dark"],
      "teams-light": ["teams"],
      "teams-dark": ["teams", "dark"],
      "teams-contrast": ["teams", "dark", "contrast"]
    }
  }
})
```

When reading, the store picks the theme whose classes are all present, preferring the one with the most matches. One
theme may have no classes, and it's the theme when no other matches; two themes with the same classes throw. Code that
only knows `.dark` keeps the user's family: adding `.dark` to `.teams` moves the store to `teams-dark`, and removing it
moves it back to `teams-light`. An attribute value that names no declared theme is ignored.

Two cases aren't treated as the user's choice:

- On the first visit, before anything is saved, the store adopts a theme the page already shows, such as one applied by
  another system's script. A bare element isn't taken as light, since it only means nothing has marked it yet. Once the
  user has a saved choice, it wins over the page.
- Another library that follows the device may switch the element before this store hears about the change. While the
  choice is `"system"`, a theme matching what the device now prefers is left to the device listener, so the store stays
  on `"system"`.

`connectThemeElement(store, options)` connects only the element, for stores whose device and storage connection lives
elsewhere.

## First paint

Without a script, the page renders the default theme and switches once the app starts. `getThemeInitScript` returns a
small script that marks the element with the saved or system theme before content renders:

```ts
import { getThemeInitScript } from "@buildkitgg/theme-core/browser"

const script = getThemeInitScript({ storageKey: "my-app-theme", element: {} })
```

Pass it the same `themes`, `system`, `defaultTheme`, storage, and `element` options as the store, and it validates them
the same way. Put it at the top of `<head>`, or at the start of `<body>` when the element is `body`, with your CSP nonce
on the tag. It tolerates blocked storage and escapes its settings for HTML. It doesn't follow changes, so still connect
the store.

See the [maintenance guide](docs/README.md).
