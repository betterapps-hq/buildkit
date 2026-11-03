import { defineCatalog, definePreset, defineQuestion, defineTemplate } from "@buildkitgg/scaffolder"
import { betterAuth } from "./addons/better-auth.js"
import { ci } from "./addons/ci.js"
import { i18n } from "./addons/i18n.js"
import { sql } from "./addons/sql.js"
import { tanstackStart } from "./target.js"
import { catalogVersion } from "./version.js"
import { versions } from "./versions.js"

/**
 * Buildkit's catalog: what `buildkit create` can make, and what `buildkit add` can add. The database and sign-in
 * questions default to "no" while the Better Apps packages they use are unpublished, so a new app installs from npm
 * today.
 */
export const catalog = defineCatalog({
  id: "@buildkitgg/catalog",
  version: catalogVersion,
  facets: ["react", "vite", "ssr", "spa", "request-middleware", "root-loader", "router-rewrite", "server-functions"],
  versions,
  targets: [tanstackStart],
  questions: [
    defineQuestion({
      id: "database",
      title: "Database",
      question: "Add a database?",
      choose: "Which database?",
      pick: "one",
      choices: ["@buildkit/sql"]
    }),
    defineQuestion({
      id: "auth",
      title: "Sign-in",
      question: "Add sign-in?",
      choose: "Which sign-in?",
      pick: "one",
      choices: ["@buildkit/better-auth"]
    }),
    defineQuestion({
      id: "i18n",
      title: "Localization",
      question: "Add localization?",
      pick: "one",
      choices: ["@buildkit/i18n"]
    })
  ],
  templates: [
    defineTemplate({
      id: "app",
      title: "App",
      description: "A React app on TanStack Start, server-rendered or as a single-page app.",
      target: "tanstack-start",
      required: ["@buildkit/ci"],
      questions: ["database", "auth", "i18n"]
    })
  ],
  addons: [ci, sql, betterAuth, i18n],
  presets: [
    definePreset({
      id: "saas",
      title: "Server-rendered app with a database, sign-in and localization",
      answers: {
        template: "app",
        mode: "ssr",
        questions: { database: ["@buildkit/sql"], auth: ["@buildkit/better-auth"], i18n: ["@buildkit/i18n"] }
      }
    })
  ]
})
