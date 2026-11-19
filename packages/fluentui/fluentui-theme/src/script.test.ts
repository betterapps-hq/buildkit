import { teamsDarkTheme, teamsLightTheme, webDarkTheme, webLightTheme } from "@fluentui/react-components"
import { afterEach, expect, it } from "vite-plus/test"
import { getThemeInitScript } from "./script.js"

afterEach(() => {
  document.documentElement.className = ""
  document.documentElement.style.colorScheme = ""
  localStorage.clear()
})

/** Runs a generated script in the global scope, the way the page's script tag does. */
function runScript(source: string) {
  // oxlint-disable-next-line no-eval -- the init script is a string a page runs from a script tag, and happy-dom doesn't run script tags
  globalThis.eval(source)
}

it("marks the element with the saved theme, using the store's options", () => {
  localStorage.setItem("theme", '{"theme":"teams-dark"}')

  const script = getThemeInitScript({
    themes: {
      "fluent-light": { scheme: "light", theme: webLightTheme },
      "fluent-dark": { scheme: "dark", theme: webDarkTheme },
      "teams-light": { scheme: "light", theme: teamsLightTheme },
      "teams-dark": { scheme: "dark", theme: teamsDarkTheme }
    },
    system: { light: "fluent-light", dark: "fluent-dark" },
    storageKey: "theme",
    element: {
      classes: {
        "fluent-light": [],
        "fluent-dark": ["dark"],
        "teams-light": ["teams"],
        "teams-dark": ["teams", "dark"]
      }
    }
  })

  expect(script).not.toContain("colorBrand")
  runScript(script)
  expect(document.documentElement.className).toBe("teams dark")
  expect(document.documentElement.style.colorScheme).toBe("dark")
})

it("needs an element binding, since the store leaves the page alone without one", () => {
  // @ts-expect-error The script exists to mark the element.
  getThemeInitScript({})
  runScript(getThemeInitScript({ defaultTheme: "dark", element: {} }))
  expect(document.documentElement.className).toBe("dark")
})
