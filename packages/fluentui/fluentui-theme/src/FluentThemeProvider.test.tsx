import {
  Button,
  teamsDarkTheme,
  teamsHighContrastTheme,
  teamsLightTheme,
  webDarkTheme,
  webLightTheme
} from "@fluentui/react-components"
import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StrictMode } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, expect, it, vi } from "vite-plus/test"
import { createFluentTheme, FluentThemeProvider, useTheme } from "./index.js"

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

it("reacts to external selection and maps custom tokens under StrictMode", async () => {
  const store = createFluentTheme({
    lightTheme: { ...webLightTheme, colorBrandBackground: "red" },
    darkTheme: { ...webDarkTheme, colorBrandBackground: "purple" }
  })

  function Consumer() {
    const state = useTheme(store)

    return <Button onClick={() => store.setTheme("dark")}>{state.resolvedTheme}</Button>
  }

  const view = render(
    <StrictMode>
      <FluentThemeProvider store={store} dir="rtl" data-testid="provider">
        <Consumer />
      </FluentThemeProvider>
    </StrictMode>
  )

  expect(screen.getByTestId("provider").getAttribute("dir")).toBe("rtl")
  await userEvent.click(screen.getByRole("button", { name: "light" }))
  expect(screen.getByRole("button", { name: "dark" })).toBeDefined()
  expect(
    Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules, (rule) => rule.cssText))
      .join("\n")
  ).toMatch(/--colorBrandBackground:\s*purple/)
  act(() => store.reset())
  expect(screen.getByRole("button", { name: "light" })).toBeDefined()
  view.unmount()
})

it("shares browser connections, restores selection and cleans up idempotently", () => {
  localStorage.setItem("fluent-test", '{"theme":"dark"}')
  const store = createFluentTheme({ storageKey: "fluent-test" })
  const stop = store.start()
  const stopOther = store.start()
  expect(store.getSnapshot().theme).toBe("dark")
  expect(store.themes.dark).toBe(webDarkTheme)
  stop()
  stop()
  store.setTheme("light")
  expect(localStorage.getItem("fluent-test")).toBe('{"theme":"light"}')
  stopOther()
  store.setTheme("dark")
  expect(localStorage.getItem("fluent-test")).toBe('{"theme":"light"}')
  store.start()()
  expect(store.getSnapshot().theme).toBe("light")
})

const teams = {
  "fluent-light": { scheme: "light", theme: webLightTheme },
  "fluent-dark": { scheme: "dark", theme: webDarkTheme },
  "teams-light": { scheme: "light", theme: teamsLightTheme },
  "teams-dark": { scheme: "dark", theme: teamsDarkTheme },
  "teams-contrast": { scheme: "dark", theme: teamsHighContrastTheme }
} as const

it("maps declared themes to their Fluent themes and follows the system pair", () => {
  const store = createFluentTheme({ themes: teams, system: { light: "fluent-light", dark: "fluent-dark" } })
  expect(store.themes["teams-contrast"]).toBe(teamsHighContrastTheme)

  function Consumer() {
    return <span>{useTheme(store).resolvedTheme}</span>
  }

  render(
    <FluentThemeProvider store={store}>
      <Consumer />
    </FluentThemeProvider>
  )
  expect(screen.getByText("fluent-light")).toBeDefined()
  act(() => store.setSystemThemes({ light: "teams-light", dark: "teams-dark" }))
  expect(screen.getByText("teams-light")).toBeDefined()
  act(() => store.setTheme("teams-contrast"))
  expect(screen.getByText("teams-contrast")).toBeDefined()
  // @ts-expect-error Only declared themes are accepted.
  expect(() => store.setTheme("dark")).toThrow(TypeError)
})

it("binds to the page only when asked, so CSS-first code and Fluent stay in step", async () => {
  const root = document.documentElement
  const plain = createFluentTheme({ defaultTheme: "dark" })
  plain.start()()
  const stopPlain = plain.start()
  expect(root.className).toBe("")
  stopPlain()

  const store = createFluentTheme({
    themes: teams,
    system: { light: "fluent-light", dark: "fluent-dark" },
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

  const stop = store.start()
  store.setTheme("teams-light")
  expect(root.className).toBe("teams")
  // A script outside React switches the page to dark
  root.classList.add("dark")
  await new Promise((resolve) => setTimeout(resolve))
  expect(store.getSnapshot().theme).toBe("teams-dark")
  stop()
  expect(root.className).toBe("")
  root.style.colorScheme = ""
})

it("takes lightTheme and darkTheme only with the default themes", () => {
  const mixed = () =>
    createFluentTheme({
      themes: teams,
      system: { light: "fluent-light", dark: "fluent-dark" },
      // @ts-expect-error Declared themes carry their own Fluent themes.
      lightTheme: webLightTheme
    })

  expect(mixed).toThrow(TypeError)
  expect(() =>
    // @ts-expect-error Every declared theme needs a Fluent theme.
    createFluentTheme({ themes: { light: { scheme: "light" }, dark: { scheme: "dark", theme: webDarkTheme } } })
  ).toThrow(TypeError)
})

it("renders the server default without connecting browser storage", () => {
  const store = createFluentTheme({ defaultTheme: "dark" })
  vi.stubGlobal("window", undefined)
  store.start()()

  function Consumer() {
    return <span>{useTheme(store).resolvedTheme}</span>
  }

  expect(
    renderToString(
      <FluentThemeProvider store={store}>
        <Consumer />
      </FluentThemeProvider>
    )
  ).toContain("dark")
})
