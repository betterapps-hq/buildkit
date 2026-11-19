import { act, cleanup, renderHook } from "@testing-library/react"
import { StrictMode } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, expect, it } from "vite-plus/test"
import { createThemeStore, useTheme } from "./index.js"

afterEach(cleanup)

it("updates without a provider when called outside React", () => {
  const store = createThemeStore()
  const { result, unmount } = renderHook(() => useTheme(store), { wrapper: StrictMode })
  act(() => store.setTheme("dark"))
  expect(result.current.resolvedTheme).toBe("dark")
  expect(result.current.colorScheme).toBe("dark")
  act(() => result.current.setTheme("light"))
  expect(store.getSnapshot().theme).toBe("light")
  act(() => result.current.reset())
  expect(store.getSnapshot().theme).toBe("system")
  unmount()
  expect(() => store.setTheme("system")).not.toThrow()
})

it("types declared themes and the system pair", () => {
  const store = createThemeStore({
    themes: { "teams-light": { scheme: "light" }, "teams-dark": { scheme: "dark" } },
    system: { light: "teams-light", dark: "teams-dark" }
  })

  const { result } = renderHook(() => useTheme(store))
  act(() => result.current.setTheme("teams-dark"))
  expect(result.current.resolvedTheme).toBe("teams-dark")
  act(() => result.current.setSystemThemes({ light: "teams-light", dark: "teams-dark" }))
  expect(result.current.isTheme("teams-light")).toBe(true)
  // @ts-expect-error Only declared themes are accepted.
  expect(() => result.current.setTheme("dark")).toThrow(TypeError)
  const resolved: "teams-light" | "teams-dark" = result.current.resolvedTheme
  expect(resolved).toBe("teams-dark")
})

it("renders an immutable server snapshot", () => {
  const store = createThemeStore({ defaultTheme: "light" })
  store.setTheme("dark")

  function Consumer() {
    return <span>{useTheme(store).resolvedTheme}</span>
  }

  expect(renderToString(<Consumer />)).toBe("<span>light</span>")
})
