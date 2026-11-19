# @buildkitgg/shadcn-theme

Light, dark and system themes for an app built on shadcn components. It remembers the user's choice, puts `.dark` and
`color-scheme` on `<html>` so shadcn's dark variables reach every component, portaled dialogs and menus included, and
gives you a script that sets the theme before first paint. It also follows changes other code makes to that class, so
React components and scripts outside React share one theme. Declare your own themes when light and dark aren't enough.
React is a peer dependency.

The colors come from the components' CSS variables; see [theming](../../../docs/shadcn/theming.md) to change them.

## Set up

Create one theme store for the document:

```ts
// theme.ts
import { createShadcnTheme } from "@buildkitgg/shadcn-theme"

export const theme = createShadcnTheme({
  defaultTheme: "system",
  storageKey: "my-app-theme"
})
```

| Option         | Default          | What it does                                                          |
| -------------- | ---------------- | --------------------------------------------------------------------- |
| `defaultTheme` | `"system"`       | A theme name or `"system"`, used until the user picks one             |
| `storageKey`   | none             | Where the choice is saved. Omit it to keep the choice in memory only  |
| `storage`      | `"localStorage"` | `"sessionStorage"` keeps the choice per tab. Needs `storageKey`       |
| `themes`       | light and dark   | The themes users choose from; see [your own themes](#your-own-themes) |
| `system`       | light and dark   | The themes `"system"` follows when the device prefers light or dark   |
| `target`       | `"html"`         | The element that carries the theme: `"html"` or `"body"`              |
| `attribute`    | none             | Also writes the theme name to this attribute, such as `"data-theme"`  |
| `colorScheme`  | `true`           | Sets the element's `color-scheme` to the theme's scheme               |

A saved choice overrides `defaultTheme`. Changes to the system preference affect the page only while the choice is
`"system"`.

Creating the store touches no browser APIs, so it's safe on the server. Start it in the browser:

```ts
const stop = theme.start()
```

`start()` applies the theme to `<html>` and follows the user's choice, the system preference, and, when the choice is
saved, changes made in other tabs. Call `stop()` at teardown to remove the listeners and restore `<html>`'s original
classes and `color-scheme`. Starts are counted, so the last `stop()` cleans up. On the server, `start()` does nothing.

## Read and change the theme

In React, `useTheme` returns the choice, the theme it resolves to, and the functions to change it. No provider is
needed:

```tsx
import { Button } from "@buildkitgg/shadcn"
import { useTheme } from "@buildkitgg/shadcn-theme"
import { theme } from "./theme"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme(theme)

  return (
    <Button variant="outline" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      Use {resolvedTheme === "dark" ? "light" : "dark"} theme
    </Button>
  )
}
```

The hook also returns `theme`, the saved choice; `colorScheme`, light or dark underneath the resolved theme;
`setSystemThemes`; `isTheme`; and `reset`, which clears the choice and goes back to `defaultTheme`. Outside React, use
the store directly: `theme.getSnapshot()`, `theme.setTheme("dark")`, `theme.subscribe(listener)` and `theme.reset()`.

## Code outside React

The store follows the classes on `<html>`. When a script, an older theme toggle or another library adds or removes
`.dark`, the store changes theme and every `useTheme` updates. A change from React marks `<html>` the same way, so that
code sees it too.

While the choice is `"system"`, another library that follows the device may switch `.dark` before the store hears about
the change. The store treats that as the device, not as a choice, and stays on `"system"`. On a first visit, before
anything is saved, it keeps a theme the page already shows, such as one another system's script applied.

## Your own themes

Each theme is the classes that switch its CSS variables, plus the color scheme underneath it:

```ts
export const theme = createShadcnTheme({
  themes: {
    light: { scheme: "light", classes: [] },
    dark: { scheme: "dark", classes: ["dark"] },
    "teams-light": { scheme: "light", classes: ["teams"] },
    "teams-dark": { scheme: "dark", classes: ["teams", "dark"] },
    "teams-contrast": { scheme: "dark", classes: ["teams", "dark", "contrast"] }
  },
  storageKey: "my-app-theme"
})

theme.setTheme("teams-contrast")
theme.setSystemThemes({ light: "teams-light", dark: "teams-dark" }) // Teams, following the device
```

Declared themes replace light and dark. Every API takes and returns the names you declare, so `setTheme("teams-drak")`
is a compile error. `system` is optional when you declare a light theme named `light` and a dark theme named `dark`, and
required otherwise; its light slot only takes light themes, and its dark slot only dark ones.

Your CSS supplies each theme's variables. Keep `.dark` under every dark theme, and your dark styles and Tailwind's
`dark:` variant keep working, while more specific selectors override only what differs:

```css
.teams {
  --primary: oklch(0.51 0.13 277);
}

.teams.dark {
  --primary: oklch(0.68 0.12 277);
}

.teams.contrast {
  --primary: oklch(0.9 0.18 100);
  --border: oklch(1 0 0);
}
```

The store picks the theme whose classes are all present, preferring the one with the most matches, so code that only
knows `.dark` keeps the user's family: adding `.dark` to `.teams` means `teams-dark`. One theme may have no classes, and
two themes with the same classes throw when the store starts.

## First paint and server rendering

Without a script in the page's head, the page renders the default theme and switches after the app starts.
`getThemeInitScript` returns a small script that applies the saved or system theme before content renders:

```ts
import { getThemeInitScript } from "@buildkitgg/shadcn-theme"

const script = getThemeInitScript({ defaultTheme: "system", storageKey: "my-app-theme" })
```

Put it in a `<script>` tag at the top of `<head>`, or at the start of `<body>` with `target: "body"`, with your CSP
nonce on the tag. Pass it the same options as the store, declared themes included. It tolerates blocked storage and
escapes its settings for HTML. It doesn't follow changes, so still call `start()` in the browser.

The script sets classes and a style on `<html>` before hydration, so frameworks that hydrate `<html>` see a difference
there. In Next.js, put `suppressHydrationWarning` on the root `<html>` element.

When the default depends on the user, create a store per request on the server rather than sharing one across users.
Call `start()` in the browser, from the app shell's effect with its cleanup, never during render.

Types: `ShadcnThemeOptions`, `ShadcnThemeStore`, `ShadcnThemeDefinition`, `ShadcnThemeDefinitions`,
`DefaultShadcnThemes`, `ShadcnThemeElementOptions`, `ThemeInitScriptOptions`, `UseThemeResult`, `Theme`, `ThemeName`,
`ResolvedTheme`, `ColorScheme`, `SystemThemes`, `ThemesOfScheme` and `ThemeSnapshot`.

[Maintenance](docs/README.md)
