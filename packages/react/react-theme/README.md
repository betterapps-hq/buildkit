# @buildkitgg/react-theme

A React hook for a Buildkit theme store. Components and plain TypeScript share one store, with no context provider.

```sh
pnpm add @buildkitgg/react-theme react
```

```tsx
import { createThemeStore, useTheme } from "@buildkitgg/react-theme"

const theme = createThemeStore()

export function ThemeButton() {
  const { theme: preference, resolvedTheme, setTheme } = useTheme(theme)
  return (
    <button onClick={() => setTheme("dark")}>
      {preference}: {resolvedTheme}
    </button>
  )
}
```

`createThemeStore` is re-exported from [`@buildkitgg/theme-core`](../../core/theme-core/README.md), so a React app
imports from one package. Create the store once, outside render, and pass the same instance to every consumer. Code
outside React calls `theme.setTheme("dark")`, and components update through `useSyncExternalStore`. `useTheme(store)`
returns `theme`, `resolvedTheme`, `colorScheme`, `systemThemes`, `setTheme`, `setSystemThemes`, `isTheme`, and
`reset()`, which clears the user's selection and restores the configured default. React 19.2 or later is a peer
dependency.

Stores with [declared themes](../../core/theme-core/README.md#named-themes) keep their types through the hook:

```tsx
const theme = createThemeStore({
  themes: { "teams-light": { scheme: "light" }, "teams-dark": { scheme: "dark" } },
  system: { light: "teams-light", dark: "teams-dark" }
})

function Toggle() {
  const { resolvedTheme, setTheme } = useTheme(theme) // resolvedTheme is "teams-light" | "teams-dark"
  return <button onClick={() => setTheme(resolvedTheme === "teams-dark" ? "teams-light" : "teams-dark")}>Toggle</button>
}
```

The package doesn't listen to the browser, touch storage, or apply CSS; connect the store at your app's boundary, for
example with `connectBrowserTheme` from `@buildkitgg/theme-core/browser`. The server snapshot stays stable for
hydration: use the same options on server and client, and create a store per request for user-specific SSR. State the
browser resolves appears after hydration.

See the [maintenance guide](docs/README.md).
