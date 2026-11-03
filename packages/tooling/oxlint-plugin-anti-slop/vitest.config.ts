import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/vendor/**"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 75 }
    }
  }
})
