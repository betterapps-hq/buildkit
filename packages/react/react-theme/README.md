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
returns `theme`, `resolvedTheme`, `setTheme`, and `reset()`, which clears the user's selection and restores the
configured default. React 19.2 or later is a peer dependency.

The package doesn't listen to the browser, touch storage, or apply CSS; connect the store at your app's boundary, for
example with `connectBrowserTheme` from `@buildkitgg/theme-core/browser`. The server snapshot stays stable for
hydration: use the same options on server and client, and create a store per request for user-specific SSR. State the
browser resolves appears after hydration.

See the [maintenance guide](docs/README.md).
