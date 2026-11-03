import { defineConfig } from "vite-plus"

// VitePress reads back its own .temp and cache folders, its bundled config, the dist it replaces and the dependencies it
// touches, which would keep the build from ever caching, so they're left out of its inputs and the lockfile stands in for
// the dependencies. The pages scripts/generate.ts writes stay in, so the build replays only while they and the site's own
// files are unchanged. The generator runs first, uncached, since it reads back the pages it writes.
export default defineConfig({
  run: {
    tasks: {
      "build:site": {
        command: "vitepress build content",
        cache: {
          input: [
            { auto: true },
            "!content/.vitepress/.temp/**",
            "!content/.vitepress/cache/**",
            "!content/.vitepress/*.timestamp-*",
            "!dist/**",
            "!node_modules/**",
            { pattern: "pnpm-lock.yaml", base: "workspace" }
          ],
          output: [{ auto: true }, "!content/.vitepress/.temp/**", "!content/.vitepress/cache/**"]
        }
      }
    }
  }
})
