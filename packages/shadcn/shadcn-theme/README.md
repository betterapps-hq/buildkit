# @buildkitgg/shadcn-theme

Light, dark and system themes for an app built on shadcn components. It remembers the user's choice, puts `.dark` and
`color-scheme` on `<html>` so shadcn's dark variables reach every component, portaled dialogs and menus included, and
gives you a script that sets the theme before first paint. React is a peer dependency.

It only switches between light and dark. The colors come from the components' CSS variables; see
[theming](../../../docs/shadcn/theming.md) to change them.

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

| Option         | Default          | What it does                                                         |
| -------------- | ---------------- | -------------------------------------------------------------------- |
| `defaultTheme` | `"system"`       | `"light"`, `"dark"` or `"system"`, used until the user picks one     |
| `storageKey`   | none             | Where the choice is saved. Omit it to keep the choice in memory only |
| `storage`      | `"localStorage"` | `"sessionStorage"` keeps the choice per tab. Needs `storageKey`      |

A saved choice overrides `defaultTheme`. Changes to the system preference affect the page only while the choice is
`"system"`.

Creating the store touches no browser APIs, so it's safe on the server. Start it in the browser:

```ts
const stop = theme.start()
```

`start()` applies the theme to `<html>` and follows the user's choice and the system preference, and, when the choice is
saved, changes made in other tabs. Call `stop()` at teardown to remove the listeners and restore `<html>`'s original
class and `color-scheme`. Starts are counted, so the last `stop()` cleans up. On the server, `start()` does nothing.

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

The hook also returns `theme`, the saved choice, and `reset`, which clears it and goes back to `defaultTheme`. Outside
React, use the store directly: `theme.getSnapshot()`, `theme.setTheme("dark")`, `theme.subscribe(listener)` and
`theme.reset()`.

## First paint and server rendering

Without a script in the page's head, the page renders light and switches after the app starts. `getThemeInitScript`
returns a small script that applies the saved or system theme before content renders:

```ts
import { getThemeInitScript } from "@buildkitgg/shadcn-theme"

const script = getThemeInitScript({ defaultTheme: "system", storageKey: "my-app-theme" })
```

Put it in a `<script>` tag at the top of `<head>`, with your CSP nonce on the tag. Pass it the same `defaultTheme` and
storage options as the store. It tolerates blocked storage and escapes its settings for HTML. It doesn't follow changes,
so still call `start()` in the browser.

The script sets a class and a style on `<html>` before hydration, so frameworks that hydrate `<html>` see a difference
there. In Next.js, put `suppressHydrationWarning` on the root `<html>` element.

When the default depends on the user, create a store per request on the server rather than sharing one across users.
Call `start()` in the browser, from the app shell's effect with its cleanup, never during render.

Types: `ShadcnThemeOptions`, `ShadcnThemeStore`, `ThemeInitScriptOptions`, `Theme`, `ResolvedTheme` and `ThemeSnapshot`.

[Maintenance](docs/README.md)
