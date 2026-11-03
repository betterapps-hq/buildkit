import { describe, expect, it } from "vite-plus/test"
import { PlanError } from "../plan/errors.js"
import { match } from "./match.js"

describe("match", () => {
  it("runs the case for the value", () => {
    // SAFETY: widening a string literal to string always holds, and makes it a value from a catalog.
    const renderModel = "spa" as string
    expect(match(renderModel, { "ssr-loader": () => "server", spa: () => "browser" })).toBe("browser")
  })

  it("is a plan error when no case handles the value", () => {
    // SAFETY: widening a string literal to string always holds, and makes it a value from a catalog.
    const renderModel = "rsc" as string
    expect(() => match(renderModel, { "ssr-loader": () => "server", spa: () => "browser" })).toThrow(
      new PlanError("E_UNSUPPORTED", 'Nothing handles "rsc". The cases are "ssr-loader", "spa".')
    )
  })

  it("doesn't take a key from the prototype as a case", () => {
    // SAFETY: widening a string literal to string always holds, and makes it a value from a catalog.
    const value = "toString" as string
    expect(() => match(value, {})).toThrow(PlanError)
  })

  it("needs a case for each member of a union", () => {
    // SAFETY: "spa" is a member of the union; the assertion keeps TypeScript from narrowing the value to it.
    const mode = "spa" as "ssr" | "spa"
    // @ts-expect-error The "ssr" case is missing.
    expect(() => match(mode, { spa: () => 1 })).not.toThrow()
  })
})
