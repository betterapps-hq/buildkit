import { z } from "zod"
import {
  defineAddon,
  defineCatalog,
  definePreset,
  defineQuestion,
  defineTarget,
  defineTemplate
} from "../manifest/define.js"
import type { CatalogManifest } from "../manifest/types.js"

/**
 * A platform's catalog with templates on questions: a `vite-web` template and a `saas` template that extends it, shared
 * questions, add-ons that hold the rules, combination add-ons and bare add-ons. The acceptance cases run on it.
 */
export function exampleCatalog(): CatalogManifest {
  const viteReact = defineTarget({
    id: "vite-react",
    title: "React on Vite",
    description: "A React app on Vite",
    family: "vite-react",
    modes: [{ id: "spa", title: "Single-page", renderModel: "spa", facets: ["react", "vite"] }],
    base: (ctx) => [
      { kind: "json", path: "package.json", pointer: "/name", op: "set", value: ctx.project.name },
      { kind: "dependency", name: "react", version: ctx.version("react") },
      { kind: "dependency", name: "vite", version: ctx.version("vite"), dev: true }
    ]
  })

  const drizzle = defineAddon({
    id: "@acme/drizzle",
    version: "1.0.0",
    title: "Drizzle",
    description: "Typed SQL with migrations",
    provides: { orm: { name: "drizzle" }, database: { dialect: "postgresql" } },
    conflicts: ["provides:orm"],
    packages: { "drizzle-orm": ">=0.45 <1", "drizzle-kit": ">=0.31 <1" },
    contribute: (ctx) => [
      { kind: "dependency", name: "drizzle-orm", version: ctx.version("drizzle-orm") },
      { kind: "dependency", name: "drizzle-kit", version: ctx.version("drizzle-kit"), dev: true },
      { kind: "file", path: "src/db/schema.ts", content: "export {}\n", ownership: "seed" },
      {
        kind: "env",
        name: "DATABASE_URL",
        scope: "server",
        secret: true,
        required: true,
        description: "Postgres connection string",
        help: "https://neon.com/docs/connect/connect-from-any-app"
      }
    ]
  })

  const prisma = defineAddon({
    id: "@acme/prisma",
    version: "1.0.0",
    title: "Prisma",
    description: "A schema file and a generated client",
    provides: { orm: { name: "prisma" }, database: { dialect: "postgresql" } },
    contribute: (ctx) => [{ kind: "dependency", name: "prisma", version: ctx.version("prisma"), dev: true }]
  })

  const convex = defineAddon({
    id: "@acme/convex",
    version: "1.0.0",
    title: "Convex",
    description: "A hosted backend with its own database",
    provides: { database: { dialect: "convex" } },
    conflicts: ["provides:orm"],
    contribute: (ctx) => [{ kind: "dependency", name: "convex", version: ctx.version("convex") }]
  })

  const betterAuth = defineAddon({
    id: "@acme/better-auth",
    version: "1.0.0",
    title: "Better Auth",
    description: "Sign-in stored in your own database",
    provides: { auth: {} },
    requires: ["provides:orm"],
    conflicts: ["provides:auth"],
    contribute: (ctx) => [{ kind: "dependency", name: "better-auth", version: ctx.version("better-auth") }]
  })

  const clerk = defineAddon({
    id: "@acme/clerk",
    version: "1.0.0",
    title: "Clerk",
    description: "Hosted sign-in",
    provides: { auth: {} },
    contribute: (ctx) => [
      { kind: "dependency", name: "@clerk/clerk-react", version: ctx.version("@clerk/clerk-react") }
    ]
  })

  const betterAuthDrizzle = defineAddon({
    id: "@acme/better-auth-drizzle",
    version: "1.0.0",
    title: "Better Auth tables for Drizzle",
    description: "Better Auth's schema and its Drizzle adapter",
    joins: ["@acme/better-auth", "@acme/drizzle"],
    contribute: () => [{ kind: "file", path: "src/db/auth-schema.ts", content: "export {}\n", ownership: "seed" }]
  })

  const betterAuthPrisma = defineAddon({
    id: "@acme/better-auth-prisma",
    version: "1.0.0",
    title: "Better Auth models for Prisma",
    description: "Better Auth's models and its Prisma adapter",
    joins: ["@acme/better-auth", "@acme/prisma"],
    contribute: () => [{ kind: "lines", path: "prisma/schema.prisma", lines: ["model User {", "  id String @id", "}"] }]
  })

  const lingui = defineAddon({
    id: "@acme/lingui",
    version: "1.0.0",
    title: "Lingui",
    description: "Message catalogs compiled at build time",
    provides: { i18n: {} },
    conflicts: ["provides:i18n"],
    options: z.object({ locales: z.array(z.string()).default(["en"]).describe("Locales") }),
    ask: ["locales"],
    contribute: (ctx) => [{ kind: "dependency", name: "@lingui/core", version: ctx.version("@lingui/core") }]
  })

  const reactIntl = defineAddon({
    id: "@acme/react-intl",
    version: "1.0.0",
    title: "react-intl",
    description: "FormatJS messages at runtime",
    provides: { i18n: {} },
    contribute: (ctx) => [{ kind: "dependency", name: "react-intl", version: ctx.version("react-intl") }]
  })

  const sentry = defineAddon({
    id: "@acme/sentry",
    version: "1.0.0",
    title: "Sentry",
    description: "Errors and performance",
    contribute: (ctx) => [{ kind: "dependency", name: "@sentry/react", version: ctx.version("@sentry/react") }]
  })

  const posthog = defineAddon({
    id: "@acme/posthog",
    version: "1.0.0",
    title: "PostHog",
    description: "Product analytics",
    contribute: (ctx) => [{ kind: "dependency", name: "posthog-js", version: ctx.version("posthog-js") }]
  })

  const database = defineQuestion({
    id: "database",
    title: "Database",
    question: "Add a database?",
    choose: "Which one?",
    pick: "one",
    choices: [
      { addon: "@acme/drizzle", hint: "Typed SQL, runs anywhere" },
      { addon: "@acme/prisma", hint: "Schema first, generated client" },
      { addon: "@acme/convex", hint: "Hosted, no SQL to write" }
    ]
  })

  const auth = defineQuestion({
    id: "auth",
    title: "Sign-in",
    question: "Add sign-in?",
    choose: "Which provider?",
    pick: "one",
    choices: ["@acme/better-auth", "@acme/clerk"]
  })

  const telemetry = defineQuestion({
    id: "telemetry",
    title: "Telemetry",
    question: "Add telemetry?",
    choose: "Which ones?",
    pick: "many",
    choices: ["@acme/sentry", "@acme/posthog"]
  })

  return defineCatalog({
    id: "@acme/catalog",
    version: "2.0.0",
    facets: ["react", "vite"],
    range: "caret",
    versions: {
      react: "19.3.1",
      vite: "8.3.5",
      "drizzle-orm": "~0.45.4",
      "drizzle-kit": "~0.31.11",
      prisma: "6.19.0",
      convex: "1.29.0",
      "better-auth": "1.7.9",
      "@clerk/clerk-react": "5.53.0",
      "@lingui/core": "6.10.1",
      "react-intl": "8.0.0",
      "@sentry/react": "10.20.0",
      "posthog-js": "1.280.0",
      "vite-plus": "0.1.0",
      vitest: "4.0.8",
      zod: "^4.1.0",
      storybook: "10.0.0",
      "@playwright/test": "1.56.0"
    },
    targets: [viteReact],
    questions: [database, auth, telemetry],
    templates: [
      defineTemplate({
        id: "vite-web",
        title: "Web app",
        description: "A React app on Vite with tests",
        target: "vite-react",
        required: [
          { npm: "vite-plus", dev: true, title: "Vite+" },
          { npm: "vitest", dev: true, title: "Vitest" }
        ],
        questions: [
          {
            id: "localization",
            title: "Localization",
            question: "Add localization?",
            choose: "Which library?",
            pick: "one",
            default: "@acme/lingui",
            choices: ["@acme/lingui", "@acme/react-intl"]
          },
          "database",
          "auth",
          "telemetry",
          {
            id: "devtools",
            title: "Developer tools",
            question: "Add developer tools?",
            choose: "Which ones?",
            pick: "many",
            choices: [
              { npm: "storybook", dev: true, title: "Storybook", hint: "Build components in isolation" },
              { npm: "@playwright/test", dev: true, title: "Playwright", hint: "End-to-end tests" }
            ]
          }
        ],
        gallery: { tags: ["react", "vite"], image: "gallery/vite-web.png" }
      }),
      defineTemplate({
        id: "saas",
        title: "SaaS starter",
        description: "Sign-in, a database and analytics, ready to deploy",
        extends: "vite-web",
        required: ["npm:zod"],
        questions: [
          { use: "database", required: true, default: "@acme/drizzle" },
          { use: "auth", required: true, default: "@acme/better-auth" },
          { use: "telemetry", default: ["@acme/posthog"] }
        ],
        omit: ["devtools"],
        gallery: { tags: ["saas", "auth", "database"], links: { demo: "https://saas.acme.dev" } }
      })
    ],
    addons: [
      drizzle,
      prisma,
      convex,
      betterAuth,
      clerk,
      betterAuthDrizzle,
      betterAuthPrisma,
      lingui,
      reactIntl,
      sentry,
      posthog
    ],
    presets: [
      definePreset({
        id: "saas-prisma",
        title: "SaaS starter on Prisma",
        answers: { template: "saas", questions: { database: ["@acme/prisma"], telemetry: [] } }
      })
    ]
  })
}
