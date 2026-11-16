import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    // The generated components import their CSS, which Node can't load, so Vite processes them.
    server: { deps: { inline: [/[/\\]\.buildkit[/\\]shadcn[/\\]/] } },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 75 }
    }
  }
})
