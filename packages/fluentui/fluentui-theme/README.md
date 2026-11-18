# @buildkitgg/fluentui-theme

Light, dark, and system themes for Fluent UI v9, with the user's choice saved and shared between React components and
plain TypeScript. Selection lives in Buildkit's framework-independent theme store, and the package maps it to Fluent
themes.

```sh
pnpm add @buildkitgg/fluentui-theme @fluentui/react-components react react-dom
```

```tsx
import { createFluentTheme, FluentThemeProvider, useTheme } from "@buildkitgg/fluentui-theme"

export const theme = createFluentTheme({
  defaultTheme: "system", // Default; use "dark" for a dark-first app.
  storageKey: "my-app-theme", // Omit for memory-only selection.
  storage: "localStorage" // Or "sessionStorage".
})

export function App() {
  return (
    <FluentThemeProvider store={theme}>
      <Settings />
    </FluentThemeProvider>
  )
}

function Settings() {
  const { theme: selection, setTheme } = useTheme(theme)
  return <button onClick={() => setTheme("dark")}>{selection}</button>
}

// Code outside React uses the same store:
theme.setTheme("light")
theme.reset()
```

React 19.2 or later, React DOM, and Fluent UI v9 are peer dependencies. `FluentThemeProvider` renders Fluent's
`FluentProvider` with the resolved theme, so Fluent styling, context, and portals work as usual. Because selection lives
in the store, `useTheme` and code outside React don't need React context. Other `FluentProvider` props, such as `dir`,
`targetDocument`, `className`, and `ref`, pass through. theme-core's `Theme` type is exported as `ThemeSelection`, so it
doesn't clash with Fluent's `Theme`.

## Custom themes

Pass complete Fluent `Theme` objects as `lightTheme` and `darkTheme`. Build them with Fluent's `createLightTheme(brand)`
and `createDarkTheme(brand)`, or spread `webLightTheme` or `webDarkTheme` and override tokens. Each one defaults to
Fluent's web theme on its own. Only the selection is saved, never the token objects.

## Lifecycle and server rendering

Mounting the provider connects the device's appearance setting and the optional storage; unmounting disconnects them.
Several providers can share a store, and React Strict Mode works. Outside React, call `const stop = theme.start()` and
call `stop()` when you're done. Connections are reference-counted, and calling `stop` more than once is safe. The
package changes no document-wide CSS classes.

Create a separate store per server request. `systemTheme` sets what `"system"` resolves to on the server, `"light"` by
default. The saved choice is restored after mount, so the appearance can change during hydration. Use the same options
on server and client, and if the request tells you the user's theme, use it for the initial options so the first paint
matches. For another window, pass its `window` to `createFluentTheme` and its document as the provider's
`targetDocument`.

`theme.reset()`, or `reset` from `useTheme`, clears the saved selection and restores `defaultTheme`. With local storage,
other tabs follow. Persistence is internal; you only use the theme API.

Run the examples with `pnpm --filter @buildkitgg/behavior-storybook storybook`.
