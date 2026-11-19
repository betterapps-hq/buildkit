import { describe, expect, it, vi } from "vite-plus/test"
import { createThemeStore, isTheme } from "./index.js"

describe("theme store", () => {
  it("resets to the configured default without exposing persistence internals", () => {
    const store = createThemeStore({ defaultTheme: "dark" })
    store.setTheme("light")
    store.reset()
    expect(store.getSnapshot().resolvedTheme).toBe("dark")
    store.setTheme("system")
    store.reset()
    expect(store.getSnapshot().theme).toBe("dark")
    expect("preferences" in store).toBe(false)
  })
  it("resolves system preferences and keeps unchanged snapshots stable", () => {
    const store = createThemeStore()
    const initial = store.getSnapshot()
    const listener = vi.fn<() => void>()
    const unsubscribe = store.subscribe(listener)
    store.setTheme("system")
    expect(store.getSnapshot()).toBe(initial)
    store.setSystemTheme("dark")
    expect(store.getSnapshot()).toEqual({
      theme: "system",
      resolvedTheme: "dark",
      colorScheme: "dark",
      systemThemes: { light: "light", dark: "dark" }
    })
    store.setTheme("light")
    const explicit = store.getSnapshot()
    store.setSystemTheme("light")
    expect(store.getSnapshot()).toBe(explicit)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.getServerSnapshot()).toBe(initial)
    unsubscribe()
    store.setTheme("dark")
    expect(listener).toHaveBeenCalledTimes(2)
  })
  it("isolates instances and freezes snapshots", () => {
    const one = createThemeStore({ defaultTheme: "dark" })
    const two = createThemeStore({ systemTheme: "dark" })
    one.setTheme("light")
    expect(two.getSnapshot().resolvedTheme).toBe("dark")
    expect(Object.isFrozen(one.getSnapshot())).toBe(true)
    expect(isTheme("invalid")).toBe(false)
    expect(isTheme(null)).toBe(false)
  })
  it("rejects invalid calls from JavaScript", () => {
    // @ts-expect-error Initial configuration is a runtime boundary too.
    expect(() => createThemeStore({ defaultTheme: "invalid" })).toThrow(TypeError)
    // @ts-expect-error A system appearance cannot itself be system.
    expect(() => createThemeStore({ systemTheme: "system" })).toThrow(TypeError)
    const store = createThemeStore()
    // @ts-expect-error Intentional runtime boundary check.
    expect(() => store.setTheme("invalid")).toThrow(TypeError)
    // @ts-expect-error Intentional runtime boundary check.
    expect(() => store.setSystemTheme("system")).toThrow(TypeError)
  })
})

const teams = {
  "fluent-light": { scheme: "light" },
  "fluent-dark": { scheme: "dark" },
  "teams-light": { scheme: "light" },
  "teams-dark": { scheme: "dark" },
  "teams-contrast": { scheme: "dark" }
} as const

describe("named themes", () => {
  it("resolves declared themes, their schemes and the system pair", () => {
    const store = createThemeStore({ themes: teams, system: { light: "fluent-light", dark: "fluent-dark" } })
    expect(store.getSnapshot()).toEqual({
      theme: "system",
      resolvedTheme: "fluent-light",
      colorScheme: "light",
      systemThemes: { light: "fluent-light", dark: "fluent-dark" }
    })
    store.setTheme("teams-contrast")
    expect(store.getSnapshot().colorScheme).toBe("dark")
    store.setTheme("system")
    store.setSystemTheme("dark")
    expect(store.getSnapshot().resolvedTheme).toBe("fluent-dark")
    expect(Object.isFrozen(store.getSnapshot().systemThemes)).toBe(true)
  })

  it("changes both themes of the system pair in one update, and reset clears it", () => {
    const store = createThemeStore({ themes: teams, system: { light: "fluent-light", dark: "fluent-dark" } })
    const listener = vi.fn<() => void>()
    store.subscribe(listener)
    store.setSystemThemes({ light: "teams-light", dark: "teams-dark" })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().resolvedTheme).toBe("teams-light")
    store.setTheme("teams-contrast")
    store.reset()
    expect(store.getSnapshot()).toMatchObject({
      theme: "system",
      resolvedTheme: "fluent-light",
      systemThemes: { light: "fluent-light", dark: "fluent-dark" }
    })
  })

  it("defaults the pair to light and dark when the app declares them", () => {
    const store = createThemeStore({
      themes: { light: { scheme: "light" }, dark: { scheme: "dark" }, contrast: { scheme: "dark" } },
      defaultTheme: "contrast"
    })

    expect(store.getSnapshot()).toMatchObject({ resolvedTheme: "contrast", systemThemes: { light: "light" } })
    store.reset()
    expect(store.getSnapshot().theme).toBe("contrast")
  })

  it("narrows unknown values to the declared themes", () => {
    const store = createThemeStore({ themes: teams, system: { light: "fluent-light", dark: "fluent-dark" } })
    expect(store.isTheme("teams-dark")).toBe(true)
    expect(store.isTheme("system")).toBe(true)
    expect(store.isTheme("dark")).toBe(false)
    expect(store.isTheme(undefined)).toBe(false)
    expect(createThemeStore().isTheme("dark")).toBe(true)
  })

  it("checks theme names and schemes at compile time", () => {
    const store = createThemeStore({ themes: teams, system: { light: "fluent-light", dark: "fluent-dark" } })
    // @ts-expect-error A typo isn't a declared theme.
    expect(() => store.setTheme("teams-drak")).toThrow(TypeError)
    // @ts-expect-error The light slot only takes themes declared light.
    expect(() => store.setSystemThemes({ light: "teams-dark", dark: "teams-dark" })).toThrow(TypeError)
    // @ts-expect-error Themes without light and dark need a system pair.
    expect(() => createThemeStore({ themes: teams })).toThrow(TypeError)

    const undeclaredDefault = () =>
      createThemeStore({
        themes: teams,
        system: store.getSnapshot().systemThemes,
        // @ts-expect-error The default must be a declared theme.
        defaultTheme: "dark"
      })

    expect(undeclaredDefault).toThrow(TypeError)
  })

  it("rejects invalid declarations from JavaScript", () => {
    // SAFETY: deliberately invalid pairs, for the runtime checks JavaScript callers rely on.
    const pair = { light: "light", dark: "dark" } as never
    expect(() => createThemeStore({ themes: {}, system: pair })).toThrow(TypeError)
    expect(() => createThemeStore({ themes: { system: { scheme: "light" } }, system: pair })).toThrow(TypeError)
    expect(() => createThemeStore({ themes: { "": { scheme: "light" } }, system: pair })).toThrow(TypeError)
    // @ts-expect-error A scheme is light or dark.
    expect(() => createThemeStore({ themes: { light: { scheme: "dim" }, dark: { scheme: "dark" } } })).toThrow(
      TypeError
    )
    const wrongScheme = { light: "fluent-light", dark: "teams-light" }
    // @ts-expect-error The dark slot only takes dark themes.
    expect(() => createThemeStore({ themes: teams, system: wrongScheme })).toThrow(TypeError)
  })
})
