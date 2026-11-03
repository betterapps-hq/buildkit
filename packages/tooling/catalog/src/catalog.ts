import { defineCatalog, defineQuestion, defineTemplate } from "@buildkitgg/scaffolder"
import { ci } from "./addons/ci.js"
import { i18n } from "./addons/i18n.js"
import { tanstackStart } from "./target.js"
import { catalogVersion } from "./version.js"
import { versions } from "./versions.js"

/** Buildkit's catalog: what `buildkit create` can make, and what `buildkit add` can add. */
export const catalog = defineCatalog({
  id: "@buildkitgg/catalog",
  version: catalogVersion,
  facets: ["react", "vite", "ssr", "spa", "request-middleware", "root-loader", "router-rewrite", "server-functions"],
  versions,
  targets: [tanstackStart],
  questions: [
    defineQuestion({
      id: "i18n",
      title: "Localization",
      question: "Add localization?",
      pick: "one",
      choices: [{ addon: "@buildkit/i18n", hint: "Lingui, with locale detection and localized URLs" }]
    })
  ],
  templates: [
    defineTemplate({
      id: "app",
      title: "App",
      description: "A React app on TanStack Start, server-rendered or as a single-page app.",
      target: "tanstack-start",
      required: ["@buildkit/ci"],
      questions: ["i18n"],
      gallery: {
        tags: ["react", "tanstack-start", "ssr", "spa"],
        links: {
          docs: "https://github.com/betterapps-hq/buildkit/tree/main/packages/tooling/catalog#readme",
          source: "https://github.com/betterapps-hq/buildkit/tree/main/packages/tooling/catalog"
        }
      }
    })
  ],
  addons: [ci, i18n]
})
