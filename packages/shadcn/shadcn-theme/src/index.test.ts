import { afterEach, expect, it, vi } from "vite-plus/test"
import { createShadcnTheme, getThemeInitScript } from "./index.js"

const root = document.documentElement

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  root.className = ""
  root.removeAttribute("data-theme")
  root.style.colorScheme = ""
  localStorage.clear()
})

/** MutationObserver callbacks run as microtasks, after the change that triggered them. */
const settle = () => new Promise((resolve) => setTimeout(resolve))

/** Runs a generated script in the global scope, the way the page's script tag does. */
function runScript(source: string) {
  // oxlint-disable-next-line no-eval -- the init script is a string a page runs from a script tag, and happy-dom doesn't run script tags
  globalThis.eval(source)
}

const teams = {
  light: { scheme: "light", classes: [] },
  dark: { scheme: "dark", classes: ["dark"] },
  "teams-light": { scheme: "light", classes: ["teams"] },
  "teams-dark": { scheme: "dark", classes: ["teams", "dark"] },
  "teams-contrast": { scheme: "dark", classes: ["teams", "dark", "contrast"] }
} as const

it("applies persisted preferences to the portal ancestor and cleans up the last owner", () => {
  root.className = "brand"
  root.style.colorScheme = "normal"
  localStorage.setItem("brand-theme", '{"theme":"dark"}')
  const theme = createShadcnTheme({ storageKey: "brand-theme" })
  expect(root.classList.contains("dark")).toBe(false)
  const stop = theme.start()
  const stopSecond = theme.start()
  expect(root.className).toBe("brand dark")
  expect(root.style.colorScheme).toBe("dark")
  theme.setTheme("light")
  expect(localStorage.getItem("brand-theme")).toBe('{"theme":"light"}')
  expect(root.className).toBe("brand")
  stop()
  stop()
  theme.setTheme("dark")
  expect(root.className).toBe("brand dark")
  stopSecond()
  expect(root.className).toBe("brand")
  expect(root.style.colorScheme).toBe("normal")
  theme.start()()
})

it("follows .dark when code outside React changes it", async () => {
  const theme = createShadcnTheme()
  const stop = theme.start()
  root.classList.add("dark")
  await settle()
  expect(theme.getSnapshot()).toMatchObject({ theme: "dark", resolvedTheme: "dark", colorScheme: "dark" })
  root.classList.remove("dark")
  await settle()
  expect(theme.getSnapshot().theme).toBe("light")
  stop()
})

it("marks each declared theme with its classes, keeping .dark under every dark theme", async () => {
  const theme = createShadcnTheme({ themes: teams, attribute: "data-theme" })
  const stop = theme.start()
  theme.setTheme("teams-contrast")
  expect(root.className).toBe("teams dark contrast")
  expect(root.getAttribute("data-theme")).toBe("teams-contrast")
  expect(root.style.colorScheme).toBe("dark")
  theme.setTheme("teams-light")
  root.classList.add("dark")
  await settle()
  expect(theme.getSnapshot().theme).toBe("teams-dark")
  theme.setSystemThemes({ light: "teams-light", dark: "teams-dark" })
  theme.setTheme("system")
  expect(root.className).toBe("teams")
  stop()
  expect(root.className).toBe("")
  expect(root.hasAttribute("data-theme")).toBe(false)
})

it("types declared themes and requires a system pair without light and dark", () => {
  const theme = createShadcnTheme({
    themes: { day: { scheme: "light", classes: [] }, night: { scheme: "dark", classes: ["dark"] } },
    system: { light: "day", dark: "night" }
  })

  // @ts-expect-error Not a declared theme.
  expect(() => theme.setTheme("dark")).toThrow(TypeError)
  // @ts-expect-error The pair is required when the themes aren't named light and dark.
  expect(() => createShadcnTheme({ themes: { day: { scheme: "light", classes: [] } } })).toThrow(TypeError)
  // @ts-expect-error Every theme declares its classes.
  createShadcnTheme({ themes: { light: { scheme: "light" }, dark: { scheme: "dark", classes: ["dark"] } } })
})

it("rejects themes that share classes when it starts", () => {
  const theme = createShadcnTheme({
    themes: { light: { scheme: "light", classes: [] }, dark: { scheme: "dark", classes: [] } }
  })

  expect(() => theme.start()).toThrow(/same classes/)
})

it("constructs and starts harmlessly on the server", () => {
  vi.stubGlobal("window", undefined)
  const theme = createShadcnTheme()
  expect(theme.getServerSnapshot().theme).toBe("system")
  theme.start()()
})

it("generates an early script that marks the same classes as the store", () => {
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  vi.spyOn(media, "matches", "get").mockReturnValue(true)
  vi.spyOn(window, "matchMedia").mockReturnValue(media)
  localStorage.setItem("theme", '{"theme":"teams-contrast"}')
  runScript(getThemeInitScript({ themes: teams, storageKey: "theme", attribute: "data-theme" }))
  expect(root.className).toBe("teams dark contrast")
  expect(root.getAttribute("data-theme")).toBe("teams-contrast")
  root.className = ""
  runScript(getThemeInitScript())
  expect(root.className).toBe("dark")
})

it("encodes the script's configuration safely", () => {
  expect(getThemeInitScript()).toContain('"defaultTheme":"system"')
  const script = getThemeInitScript({ storageKey: "</script><script>alert(1)</script>", defaultTheme: "dark" })
  expect(script).not.toContain("</script>")
  expect(script).toContain("\\u003c/script>")
  expect(script).toContain('"defaultTheme":"dark"')
})
