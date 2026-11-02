import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig, lazyPlugins, type Plugin } from "vite-plus"

const page = fileURLToPath(new URL("index.html", import.meta.url))
const frame = fileURLToPath(new URL("example.html", import.meta.url))
const memoryRouter = fileURLToPath(new URL("src/frame/memoryRouter.ts", import.meta.url))
const watchedModals = fileURLToPath(new URL("src/frame/watchedModals.ts", import.meta.url))

/**
 * Three changes the example frames need, kept out of the code they show. The routing example's router lives in memory,
 * so the frame never adds to the visitor's history. The modals example's manager reports each confirm to the page's
 * wire line. The configuration example keeps its development-only overrides in this production build, since
 * overriding is what it demonstrates.
 */
function exampleFrames(): Plugin {
  const isFile = (id: string | undefined, file: string) => id?.replaceAll("\\", "/").endsWith(file) ?? false
  return {
    name: "buildkit:example-frames",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "react-router" && isFile(importer, "/src/examples/routing/router.tsx")) {
        return memoryRouter
      }
      if (
        source === "@buildkitgg/shadcn-modals-manager" &&
        isFile(importer, "/src/examples/modals/ProjectNameForm.tsx")
      ) {
        return watchedModals
      }
      return null
    },
    transform(code, id) {
      return isFile(id, "/src/examples/configuration/config.ts") ? code.replaceAll("import.meta.env.DEV", "true") : null
    }
  }
}

export default defineConfig(({ command, isSsrBuild }) => {
  const base = process.env.PAGES_BASE ?? "/"
  return {
    base,
    plugins: lazyPlugins(() => [exampleFrames(), react({ compiler: true })]),
    // The shadcn managers take the kit as a peer, so they use the app's own. In this workspace their development
    // dependency is another style, so the site's kit is resolved for them too.
    resolve: { dedupe: ["@buildkitgg/shadcn-baseui-kit"] },
    define: {
      __DOCS_URL__: JSON.stringify(command === "serve" ? "http://127.0.0.1:4180/docs/" : `${base}docs/`),
      __STORYBOOK_URL__: JSON.stringify(command === "serve" ? "http://127.0.0.1:6009/" : `${base}storybook/`)
    },
    // The page, and the frame each interactive example runs in
    build: isSsrBuild ? undefined : { rollupOptions: { input: { main: page, example: frame } } }
  }
})
