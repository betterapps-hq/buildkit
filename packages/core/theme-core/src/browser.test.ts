import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { connectBrowserTheme, connectThemeElement, getThemeInitScript } from "./browser.js"
import { createThemeStore } from "./index.js"

const root = document.documentElement

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  root.className = ""
  root.removeAttribute("data-theme")
  root.style.colorScheme = ""
  document.body.className = ""
  document.body.style.colorScheme = ""
})

/** MutationObserver callbacks run as microtasks, after the change that triggered them. */
const settle = () => new Promise((resolve) => setTimeout(resolve))

/** Makes the device prefer dark, as reported to both the store and the element binding. */
function preferDark() {
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  vi.spyOn(media, "matches", "get").mockReturnValue(true)
  vi.spyOn(window, "matchMedia").mockReturnValue(media)

  return media
}

const teams = {
  "fluent-light": { scheme: "light" },
  "fluent-dark": { scheme: "dark" },
  "teams-light": { scheme: "light" },
  "teams-dark": { scheme: "dark" },
  "teams-contrast": { scheme: "dark" }
} as const

const teamsClasses = {
  "fluent-light": [],
  "fluent-dark": ["dark"],
  "teams-light": ["teams"],
  "teams-dark": ["teams", "dark"],
  "teams-contrast": ["teams", "dark", "contrast"]
} as const

/** Runs a generated script in the global scope, the way the page's script tag does. */
function runScript(source: string) {
  // oxlint-disable-next-line no-eval -- the init script is a string a page runs from a script tag, and happy-dom doesn't run script tags
  globalThis.eval(source)
}

function createTeamsStore() {
  return createThemeStore({ themes: teams, system: { light: "fluent-light", dark: "fluent-dark" } })
}

it("loads valid preferences, writes local changes, and accepts remote reset without echo", () => {
  localStorage.setItem("theme", '{"theme":"dark"}')
  const store = createThemeStore()
  const stop = connectBrowserTheme(store, { storageKey: "theme" })
  expect(store.getSnapshot().theme).toBe("dark")
  store.setTheme("light")
  expect(localStorage.getItem("theme")).toBe('{"theme":"light"}')
  window.dispatchEvent(
    new StorageEvent("storage", { key: "unrelated", newValue: '{"theme":"dark"}', storageArea: localStorage })
  )
  expect(store.getSnapshot().theme).toBe("light")
  window.dispatchEvent(
    new StorageEvent("storage", { key: "theme", newValue: '{"theme":"dark"}', storageArea: sessionStorage })
  )
  expect(store.getSnapshot().theme).toBe("light")
  window.dispatchEvent(
    new StorageEvent("storage", { key: "theme", newValue: '{"theme":"dark"}', storageArea: localStorage })
  )
  expect(store.getSnapshot().theme).toBe("dark")
  expect(localStorage.getItem("theme")).toBe('{"theme":"light"}')
  window.dispatchEvent(new StorageEvent("storage", { key: null, newValue: null, storageArea: localStorage }))
  expect(store.getSnapshot().theme).toBe("system")
  stop()
  store.setTheme("dark")
  expect(localStorage.getItem("theme")).toBe('{"theme":"light"}')
})

it("tracks system changes, but honors explicit preference and disconnects", () => {
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  vi.spyOn(window, "matchMedia").mockReturnValue(media)
  const store = createThemeStore()
  const stop = connectBrowserTheme(store)
  vi.spyOn(media, "matches", "get").mockReturnValue(true)
  media.dispatchEvent(new Event("change"))
  expect(store.getSnapshot().resolvedTheme).toBe("dark")
  store.setTheme("light")
  media.dispatchEvent(new Event("change"))
  expect(store.getSnapshot().resolvedTheme).toBe("light")
  stop()
  store.setTheme("system")
  vi.spyOn(media, "matches", "get").mockReturnValue(false)
  media.dispatchEvent(new Event("change"))
  expect(store.getSnapshot().resolvedTheme).toBe("dark")
})

it("ignores corrupt storage and tolerates blocked reads and writes", () => {
  localStorage.setItem("theme", "corrupt")
  const store = createThemeStore({ defaultTheme: "light" })
  const stop = connectBrowserTheme(store, { storageKey: "theme" })
  expect(store.getSnapshot().theme).toBe("light")
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota")
  })
  expect(() => store.setTheme("dark")).not.toThrow()
  stop()
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked")
  })
  connectBrowserTheme(store, { storageKey: "theme" })()
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new Error("blocked")
  })
  connectBrowserTheme(store, { storageKey: "theme" })()
})

it("does not touch storage unless enabled and can be imported without a browser", () => {
  const read = vi.spyOn(window, "localStorage", "get")
  connectBrowserTheme(createThemeStore())()
  expect(read).not.toHaveBeenCalled()
  vi.stubGlobal("window", undefined)
  expect(() => connectBrowserTheme(createThemeStore())()).not.toThrow()
})

it("reset removes a saved override even when it matches the default", () => {
  const store = createThemeStore({ defaultTheme: "dark" })
  const stop = connectBrowserTheme(store, { storageKey: "theme" })
  store.setTheme("dark")
  expect(localStorage.getItem("theme")).toBe('{"theme":"dark"}')
  store.reset()
  expect(localStorage.getItem("theme")).toBeNull()
  expect(store.getSnapshot().theme).toBe("dark")
  window.dispatchEvent(
    new StorageEvent("storage", { key: "theme", newValue: '{"theme":"unknown"}', storageArea: localStorage })
  )
  expect(store.getSnapshot().theme).toBe("dark")
  stop()
})

it("rejects foreign stores instead of exposing a preferences contract", () => {
  const store = createThemeStore()
  expect(() => connectBrowserTheme({ ...store, getSnapshot: () => store.getSnapshot() })).toThrow(TypeError)
})

it("rejects incomplete storage configuration before opening browser resources", () => {
  const store = createThemeStore()
  // @ts-expect-error Storage selection requires a key.
  expect(() => connectBrowserTheme(store, { storage: "localStorage" })).toThrow(TypeError)
  expect(() => connectBrowserTheme(store, { storageKey: "" })).toThrow(TypeError)
  // @ts-expect-error Unknown storage mechanism.
  expect(() => connectBrowserTheme(store, { storageKey: "theme", storage: "unknown" })).toThrow(TypeError)
})

it("falls back to the default pair when a saved pair is no longer declared", () => {
  localStorage.setItem("theme", '{"systemLight":"retired","systemDark":"light"}')
  const store = createTeamsStore()
  const stop = connectBrowserTheme(store, { storageKey: "theme" })
  expect(store.getSnapshot().systemThemes).toEqual({ light: "fluent-light", dark: "fluent-dark" })
  stop()
})

describe("element binding", () => {
  it("leaves the document alone unless an element is configured", () => {
    preferDark()
    connectBrowserTheme(createThemeStore())()
    expect(root.className).toBe("")
    expect(root.style.colorScheme).toBe("")
  })

  it("marks html with .dark by default and restores what was there", () => {
    root.className = "brand"
    root.style.colorScheme = "normal"
    const store = createThemeStore()
    const stop = connectBrowserTheme(store, { element: {} })
    expect(root.className).toBe("brand")
    expect(root.style.colorScheme).toBe("light")
    store.setTheme("dark")
    expect(root.className).toBe("brand dark")
    expect(root.style.colorScheme).toBe("dark")
    stop()
    expect(root.className).toBe("brand")
    expect(root.style.colorScheme).toBe("normal")
  })

  it("follows classes other code changes, and no class means the theme without classes", async () => {
    const store = createThemeStore()
    const stop = connectBrowserTheme(store, { element: {} })
    root.classList.add("dark")
    await settle()
    expect(store.getSnapshot().theme).toBe("dark")
    root.classList.remove("dark")
    await settle()
    expect(store.getSnapshot().theme).toBe("light")
    stop()
    root.classList.add("dark")
    await settle()
    expect(store.getSnapshot().theme).toBe("light")
  })

  it("treats another system following the device as system, not as a choice", async () => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    vi.spyOn(window, "matchMedia").mockReturnValue(media)
    const store = createThemeStore()
    const stop = connectBrowserTheme(store, { element: {} })
    // The other system sees the device turn dark and marks the page before this store hears about it
    vi.spyOn(media, "matches", "get").mockReturnValue(true)
    root.classList.add("dark")
    await settle()
    expect(store.getSnapshot().theme).toBe("system")
    media.dispatchEvent(new Event("change"))
    expect(store.getSnapshot()).toMatchObject({ theme: "system", resolvedTheme: "dark" })
    stop()
  })

  it("keeps the family when other code only knows .dark", async () => {
    const store = createTeamsStore()
    const stop = connectBrowserTheme(store, { element: { classes: teamsClasses } })
    store.setTheme("teams-light")
    expect(root.className).toBe("teams")
    root.classList.add("dark")
    await settle()
    expect(store.getSnapshot().theme).toBe("teams-dark")
    root.classList.remove("dark")
    await settle()
    expect(store.getSnapshot().theme).toBe("teams-light")
    store.setTheme("teams-contrast")
    expect(root.className).toBe("teams dark contrast")
    store.setTheme("teams-dark")
    expect(root.className).toBe("teams dark")
    store.setTheme("fluent-light")
    expect(root.className).toBe("")
    root.classList.add("dark")
    await settle()
    expect(store.getSnapshot().theme).toBe("fluent-dark")
    stop()
  })

  it("ignores classes that match two themes equally", async () => {
    const store = createThemeStore({
      themes: { calm: { scheme: "light" }, bold: { scheme: "light" }, night: { scheme: "dark" } },
      system: { light: "calm", dark: "night" }
    })

    const stop = connectBrowserTheme(store, {
      element: { classes: { calm: ["calm"], bold: ["bold"], night: ["night"] } }
    })

    expect(root.className).toBe("calm")
    root.classList.add("bold")
    await settle()
    expect(store.getSnapshot().theme).toBe("system")
    stop()
  })

  it("reads and writes an attribute with the theme name, ignoring unknown values", async () => {
    root.setAttribute("data-theme", "legacy")
    const store = createTeamsStore()
    const stop = connectBrowserTheme(store, { element: { attribute: "data-theme" } })
    expect(root.getAttribute("data-theme")).toBe("fluent-light")
    expect(root.className).toBe("")
    root.setAttribute("data-theme", "teams-dark")
    await settle()
    expect(store.getSnapshot().theme).toBe("teams-dark")
    root.setAttribute("data-theme", "dark")
    await settle()
    expect(store.getSnapshot().theme).toBe("teams-dark")
    stop()
    expect(root.getAttribute("data-theme")).toBe("legacy")
    root.removeAttribute("data-theme")
    connectBrowserTheme(createTeamsStore(), { element: { attribute: "data-theme" } })()
    expect(root.hasAttribute("data-theme")).toBe(false)
  })

  it("follows whichever marker changed when both are configured", async () => {
    const store = createTeamsStore()
    const stop = connectBrowserTheme(store, { element: { classes: teamsClasses, attribute: "data-theme" } })
    root.classList.add("teams")
    await settle()
    expect(store.getSnapshot().theme).toBe("teams-light")
    expect(root.getAttribute("data-theme")).toBe("teams-light")
    root.setAttribute("data-theme", "teams-contrast")
    await settle()
    expect(store.getSnapshot().theme).toBe("teams-contrast")
    expect(root.className).toBe("teams dark contrast")
    // The store's own writes land in the same batch as the other script's change
    store.setTheme("teams-light")
    root.classList.add("dark")
    await settle()
    expect(store.getSnapshot().theme).toBe("teams-dark")
    stop()
  })

  it("adopts what the page shows on the first visit, but a saved choice wins", () => {
    root.className = "dark"
    const store = createThemeStore()
    connectBrowserTheme(store, { element: {} })()
    expect(store.getSnapshot().theme).toBe("dark")

    localStorage.setItem("theme", '{"theme":"light"}')
    root.className = "dark"
    const saved = createThemeStore()
    const stop = connectBrowserTheme(saved, { storageKey: "theme", element: {} })
    expect(saved.getSnapshot().theme).toBe("light")
    expect(root.className).toBe("")
    stop()
  })

  it("doesn't take a bare element on the first visit as a choice of light", () => {
    preferDark()
    const store = createThemeStore()
    const stop = connectBrowserTheme(store, { element: {} })
    expect(store.getSnapshot()).toMatchObject({ theme: "system", resolvedTheme: "dark" })
    expect(root.className).toBe("dark")
    stop()
  })

  it("can only read, only write, skip color-scheme, and target body", async () => {
    const reader = createThemeStore()
    const stopReader = connectBrowserTheme(reader, { element: { write: false } })
    reader.setTheme("dark")
    expect(root.className).toBe("")
    root.classList.add("dark")
    await settle()
    root.classList.remove("dark")
    await settle()
    expect(reader.getSnapshot().theme).toBe("light")
    stopReader()

    const writer = createThemeStore()
    const stopWriter = connectBrowserTheme(writer, { element: { read: false, target: "body", colorScheme: false } })
    writer.setTheme("dark")
    expect(document.body.className).toBe("dark")
    expect(document.body.style.colorScheme).toBe("")
    document.body.classList.remove("dark")
    await settle()
    expect(writer.getSnapshot().theme).toBe("dark")
    stopWriter()
  })

  it("can connect on its own, and does nothing without a browser", () => {
    const store = createThemeStore({ defaultTheme: "dark" })
    const stop = connectThemeElement(store, {})
    expect(root.className).toBe("dark")
    stop()
    vi.stubGlobal("window", undefined)
    expect(() => connectThemeElement(store, {})()).not.toThrow()
  })

  it("rejects markers that can't identify every theme", () => {
    const store = createTeamsStore()
    // @ts-expect-error Declared themes need classes or an attribute.
    expect(() => connectThemeElement(store, {})).toThrow(TypeError)
    // @ts-expect-error Every declared theme needs its classes.
    expect(() => connectThemeElement(store, { classes: { "fluent-light": [] } })).toThrow(TypeError)
    expect(() => connectThemeElement(store, { classes: { ...teamsClasses, "teams-light": ["dark"] } })).toThrow(
      /same classes/
    )
    const extra = { ...teamsClasses, extra: ["x"] }
    expect(() => connectThemeElement(store, { classes: extra })).toThrow(TypeError)
    expect(() => connectThemeElement(store, { classes: { ...teamsClasses, "teams-light": ["two words"] } })).toThrow(
      TypeError
    )
    expect(() => connectThemeElement(store, { attribute: "class" })).toThrow(TypeError)
    // @ts-expect-error The element is html or body.
    expect(() => connectThemeElement(store, { attribute: "data-theme", target: "main" })).toThrow(TypeError)
    expect(() => connectThemeElement({ ...store, getSnapshot: () => store.getSnapshot() }, { attribute: "x" })).toThrow(
      TypeError
    )
  })
})

describe("init script", () => {
  const run = runScript

  it("marks the element with the saved theme and pair before the app starts", () => {
    preferDark()
    localStorage.setItem("theme", '{"theme":"system","systemLight":"teams-light","systemDark":"teams-dark"}')
    run(
      getThemeInitScript({
        themes: teams,
        system: { light: "fluent-light", dark: "fluent-dark" },
        storageKey: "theme",
        element: { classes: teamsClasses, attribute: "data-theme" }
      })
    )
    expect(root.className).toBe("teams dark")
    expect(root.getAttribute("data-theme")).toBe("teams-dark")
    expect(root.style.colorScheme).toBe("dark")
  })

  it("matches the binding's defaults and ignores unknown saved values", () => {
    localStorage.setItem("theme", '{"theme":"retired","systemDark":"light"}')
    root.className = "dark"
    run(getThemeInitScript({ storageKey: "theme", defaultTheme: "light" }))
    expect(root.className).toBe("")
    expect(root.style.colorScheme).toBe("light")
    run(getThemeInitScript({ defaultTheme: "dark", element: { target: "body", colorScheme: false } }))
    expect(document.body.className).toBe("dark")
    expect(document.body.style.colorScheme).toBe("")
  })

  it("encodes configuration safely and validates it like the store", () => {
    const script = getThemeInitScript({ storageKey: "</script><script>alert(1)</script>" })
    expect(script).not.toContain("</script>")
    expect(script).toContain("\\u003c/script>")
    // @ts-expect-error Storage selection requires a key.
    expect(() => getThemeInitScript({ storage: "localStorage" })).toThrow(TypeError)
    // @ts-expect-error Declared themes need classes or an attribute.
    expect(() => getThemeInitScript({ themes: teams, system: { light: "fluent-light", dark: "fluent-dark" } })).toThrow(
      TypeError
    )
  })
})
