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

## Your own themes

When light and dark aren't enough, declare the themes users choose from. Each one is a Fluent theme plus the color
scheme underneath it:

```tsx
import {
  teamsDarkTheme,
  teamsHighContrastTheme,
  teamsLightTheme,
  webDarkTheme,
  webLightTheme
} from "@fluentui/react-components"

export const theme = createFluentTheme({
  themes: {
    "fluent-light": { scheme: "light", theme: webLightTheme },
    "fluent-dark": { scheme: "dark", theme: webDarkTheme },
    "teams-light": { scheme: "light", theme: teamsLightTheme },
    "teams-dark": { scheme: "dark", theme: teamsDarkTheme },
    "teams-contrast": { scheme: "dark", theme: teamsHighContrastTheme }
  },
  system: { light: "fluent-light", dark: "fluent-dark" },
  storageKey: "my-app-theme"
})

theme.setTheme("teams-contrast")
theme.setSystemThemes({ light: "teams-light", dark: "teams-dark" }) // Teams, following the device
```

Every API takes and returns the names you declare, so `setTheme("teams-drak")` is a compile error, and `theme.themes`
maps each name to its Fluent theme. `"system"` resolves through the `system` pair, whose light slot only takes light
themes and dark slot only dark ones. It's optional when you declare a light theme named `light` and a dark theme named
`dark`, and required otherwise. Declared themes carry their own Fluent themes, so they don't take `lightTheme` or
`darkTheme`.

## Code outside React and CSS-first styles

By default the package changes no document-wide CSS classes. When part of the app still styles `.dark` or `data-theme`,
for example during a move to Fluent, or when a script outside React switches the theme, add an `element` binding. It
keeps a class or attribute on `<html>` in step with the store, in both directions:

```ts
export const theme = createFluentTheme({ storageKey: "my-app-theme", element: {} }) // .dark for dark, no class for light
```

When the theme changes from React, `.dark` follows, so the older CSS does too. When other code adds or removes `.dark`,
the store changes theme and the provider switches Fluent themes. Declared themes list their classes or use an attribute;
see [binding to the page](../../core/theme-core/README.md#binding-to-the-page) for every option and how classes are
matched.

With a binding, add the first-paint script from the `script` entry point, which server code can import without the
client components:

```ts
import { getThemeInitScript } from "@buildkitgg/fluentui-theme/script"

const script = getThemeInitScript({ storageKey: "my-app-theme", element: {} })
```

Pass it the same options as the store, and put it at the top of `<head>` with your CSP nonce on the tag.

## Lifecycle and server rendering

Mounting the provider connects the device's appearance setting, the optional storage, and the optional element binding;
unmounting disconnects them. Several providers can share a store, and React Strict Mode works. Outside React, call
`const stop = theme.start()` and call `stop()` when you're done. Connections are reference-counted, and calling `stop`
more than once is safe.

Create a separate store per server request. `systemTheme` sets what `"system"` resolves to on the server, `"light"` by
default. The saved choice is restored after mount, so the appearance can change during hydration. Use the same options
on server and client, and if the request tells you the user's theme, use it for the initial options so the first paint
matches. For another window, pass its `window` to `createFluentTheme` and its document as the provider's
`targetDocument`.

`theme.reset()`, or `reset` from `useTheme`, clears the saved selection and restores `defaultTheme`. With local storage,
other tabs follow. Persistence is internal; you only use the theme API.

Run the examples with `pnpm --filter @buildkitgg/behavior-storybook storybook`.
