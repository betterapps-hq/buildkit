import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    include: ["src/**/*.test.ts"],
    // The sync tests run the shadcn CLI, TypeScript and Tailwind on the whole catalog in a temp app.
    testTimeout: 180000,
    hookTimeout: 180000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // The preload runs inside the shadcn CLI's process, and the bin only starts the CLI.
      exclude: ["src/**/*.test.ts", "src/bin.ts", "src/preload.cjs"],
      thresholds: { statements: 85, lines: 85, functions: 85, branches: 75 }
    }
  }
})
