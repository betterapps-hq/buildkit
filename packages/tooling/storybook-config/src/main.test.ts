import { existsSync } from "node:fs"
import { isAbsolute, join } from "node:path"
import { describe, expect, it } from "vite-plus/test"
import { baseConfig, defineMain, packageFolder } from "./main.js"

describe("packageFolder", () => {
  it("finds a dependency's folder from this package, where pnpm puts it", () => {
    const folder = packageFolder("@storybook/addon-a11y")

    expect(isAbsolute(folder)).toBe(true)
    expect(existsSync(join(folder, "package.json"))).toBe(true)
  })
})

describe("baseConfig", () => {
  it("names its framework and addons by folder, so an app under pnpm needn't install them", () => {
    expect(baseConfig.framework).toEqual({ name: packageFolder("@storybook/react-vite"), options: {} })
    expect(baseConfig.addons).toEqual([
      packageFolder("@storybook/addon-a11y"),
      packageFolder("@storybook/addon-vitest")
    ])
  })
})

describe("defineMain", () => {
  it("takes a config without a framework and keeps the base's", () => {
    const main = defineMain({ stories: ["../src/**/*.stories.tsx"] })

    expect(main.framework).toEqual(baseConfig.framework)
    expect(main.stories).toEqual(["../src/**/*.stories.tsx"])
  })

  it("adds an app's addons after the base's", () => {
    const main = defineMain({ stories: [], addons: ["my-addon"] })

    expect(main.addons).toEqual([...(baseConfig.addons ?? []), "my-addon"])
  })
})
