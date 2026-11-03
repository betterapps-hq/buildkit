# Scaffolder: templates for platforms

How `@buildkitgg/scaffolder` changes so a platform can publish many starter templates, each a curated menu over one
library of add-ons. A vibe coder runs one command, answers a few questions, and gets a project built on the platform's
recommended stack. The engine itself is described in [scaffolder-research.md](scaffolder-research.md) and built in
[scaffolder-phase-0.md](scaffolder-phase-0.md). Third-party templates started in
[scaffolder-template-packages.md](scaffolder-template-packages.md).

**Status (2026-11-03):** phases A to D are built, and E1. Main is versioned 0.8.0 with 0.9.0's change files pending, but
npm still has 0.6.0: releases fail until npm's trusted publishers name `betterapps-hq/buildkit` instead of the old
`AndrewCraswell/buildkit`. E2 and E3 wait for that release. The `groups` work on `claude/scaffolder-picks` (e5a118a) was
superseded by questions and never merged.

## Why

A template today offers add-ons three ways, and each works differently:

| Today      | Where its choices are listed                           | What the wizard asks                                |
| ---------- | ------------------------------------------------------ | --------------------------------------------------- |
| `optional` | The template, by id                                    | All of them in one "Add any of these?" multi-select |
| `slots`    | The catalog: every add-on that says `slot: "database"` | "Add a database?", then one of them                 |
| `groups`   | The template (unreleased)                              | "Add telemetry?", then one or many                  |

Slots mix two things. The rule that only one ORM goes in a project is a fact about the add-ons, true in every template
and after `create`. The question "Add a database?" and which ORMs to recommend belong to one template. With slots, a
template can't choose its own options, and a new ORM in the catalog shows up in every template's question.

This plan separates them. **Add-ons state what's true wherever they're installed**: what they provide, need and can't be
used with. **Templates ask questions**: an ordered list, each with its own choices. Around that it adds what a platform
with many templates needs: shared questions and template inheritance, bare add-ons for packages with no setup, version
ranges, combination add-ons, choices that explain themselves, choices that depend on earlier answers, optional setup
steps, gallery metadata, and third-party templates and add-ons.

## Owner decisions (2026-11-02)

| Decision                                                                                                         | What it changes                                                       |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **One ordered list of questions** replaces `optional`, `slots` and `groups`                                      | `defineSlot`, `slot` and `slot:` go away. Breaking, before 1.0        |
| **Add-ons hold the rules**: `provides`, `requires` and `conflicts`, which now takes `provides:<name>`            | "Only one ORM" is one line on an add-on, enforced by `add` too        |
| **Bare add-ons**: a package with no setup is named in a template, with no `defineAddon`                          | `npm:zod` in `required` or a question's choices                       |
| **Version pins are npm ranges**, written in a style the catalog picks, and add-ons say which ranges they support | Catalog CI checks every pin, and can check them against npm           |
| **Combination add-ons** hold the glue between two choices, such as Better Auth's Drizzle adapter                 | `joins` on an add-on. `ctx.selected()` stays for small branches       |
| **Shared questions and template inheritance**                                                                    | `questions` on the catalog, `extends` and `omit` on templates         |
| **Choices that explain themselves**: a hint per choice, a help link per env var                                  | Shown by the wizard and `catalog --json`                              |
| **Choices that depend on earlier answers**, from the add-ons' rules, plus `when` for the rest                    | Unavailable choices show why, such as "Needs Drizzle or Prisma"       |
| **Optional setup steps** after `create`: install, setup commands, git                                            | The user opts in. Nothing runs without a yes or `--setup`             |
| **Gallery metadata** on templates                                                                                | Tags, an image and links, and a derived stack, in `catalog --json`    |
| **Third-party templates and add-ons**: packs extend the catalog's templates, and add-on packages work with `add` | Packs gain `questions` and `versions`. `defineAddonPack` is new       |
| **Not doing:** add-ons contributing agent context, and new work on agent migrations                              | `AGENTS.md` stays a sample file. `kind: "agent"` migrations are as-is |

## Done when

- Every type in [The API](#the-api) is exported from `@buildkitgg/scaffolder`, and the engine passes every
  [acceptance case](#acceptance-cases).
- `checkCatalog` reports every problem in [Catalog checks](#catalog-checks), and `catalog check --registry` checks pins
  against npm.
- The wizard asks questions as [The wizard](#the-wizard) describes, with clack, and offers the setup steps.
- Buildkit's catalog and SpawnKit's catalog are on questions, and both pass their matrix checks and smoke tests.
- The site's scaffolder sample shows the released API.
- `pnpm verify` passes.

## Concepts after this change

| Concept                | What it is                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| **Catalog**            | A platform's versioned package: targets, add-ons, shared questions, templates, presets and pins         |
| **Target**             | A framework and its modes, with base files and extension points. Unchanged                              |
| **Add-on**             | How to install one thing: contributions, options, and the rules true wherever it's installed            |
| **Bare add-on**        | One package at the catalog's pin, and nothing else. Named `npm:<package>`                               |
| **Combination add-on** | The glue between add-ons, selected only when all of them are                                            |
| **Question**           | Yes or no (unless required), then one choice or several. Defined in a template or shared by the catalog |
| **Template**           | A target, the add-ons always installed, and the questions, in order. Can extend another template        |
| **Preset**             | Saved answers for a template. Unchanged, apart from the answers' shape                                  |
| **Template package**   | A third party's templates, add-ons and questions, on a product's catalog                                |
| **Add-on package**     | A third party's add-ons, for `add <package>`                                                            |

A **preset** and a **template that extends another** differ: a preset answers the same questions in advance, and an
extending template changes the questions themselves.

## A catalog, start to finish

This catalog has a `vite-web` template and a `saas` template that extends it. It's type-checked against
[The API](#the-api), and the [reference model](#validation) runs it.

```ts
import {
  defineAddon,
  defineAddonPack,
  defineCatalog,
  definePack,
  definePreset,
  defineQuestion,
  defineTemplate
} from "@buildkitgg/scaffolder"
import { z } from "zod"
import { viteReact } from "./target.js"

// Add-ons that do real setup. Each states what's true wherever it's installed.

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
    { kind: "script", name: "db:push", command: "drizzle-kit push" },
    {
      kind: "env",
      name: "DATABASE_URL",
      scope: "server",
      secret: true,
      required: true,
      description: "Postgres connection string",
      help: "https://neon.com/docs/connect/connect-from-any-app"
    },
    {
      kind: "command",
      run: "pnpm db:push",
      when: "after-install",
      why: "Creates the tables",
      setup: true
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
  // Convex is the database and the server, so no ORM goes with it.
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
    { kind: "dependency", name: "@clerk/clerk-react", version: ctx.version("@clerk/clerk-react") },
    {
      kind: "env",
      name: "CLERK_SECRET_KEY",
      scope: "server",
      secret: true,
      required: true,
      description: "Clerk secret key",
      help: "https://dashboard.clerk.com/last-active?path=api-keys"
    }
  ]
})

// Combination add-ons: the glue between two choices lives on its own and is planned only when both are picked.

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
  contribute: () => [
    {
      kind: "lines",
      path: "prisma/schema.prisma",
      lines: ["model User {", "  id String @id", "}"]
    }
  ]
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

// Questions every template can use.

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

export default defineCatalog({
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
        // Better Auth needs an ORM, so with Convex or no database it shows as unavailable, with the reason.
        "auth",
        "telemetry",
        {
          id: "devtools",
          title: "Developer tools",
          question: "Add developer tools?",
          choose: "Which ones?",
          pick: "many",
          choices: [
            {
              npm: "storybook",
              dev: true,
              title: "Storybook",
              hint: "Build components in isolation"
            },
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

// A third party's template package: a template on the catalog's own, and one add-on of its own.

export const pack = definePack({
  extends: { catalog: "@acme/catalog", versions: "^2.0.0" },
  versions: { stripe: "^19.0.0" },
  addons: [
    defineAddon({
      id: "@shopco/starter/stripe",
      version: "1.0.0",
      title: "Stripe",
      description: "Checkout and webhooks",
      requires: ["provides:database"],
      contribute: (ctx) => [{ kind: "dependency", name: "stripe", version: ctx.version("stripe") }]
    })
  ],
  templates: [
    defineTemplate({
      id: "shop",
      title: "Shop",
      description: "The SaaS starter with Stripe checkout",
      extends: "saas",
      required: ["@shopco/starter/stripe"]
    })
  ]
})

// A third party's add-on package, for `acme add @shopco/resend`.

export const addonPack = defineAddonPack({
  extends: { catalog: "@acme/catalog", versions: "^2.0.0" },
  versions: { resend: "^6.0.0" },
  addons: [
    defineAddon({
      id: "@shopco/resend/email",
      version: "1.0.0",
      title: "Resend",
      description: "Transactional email",
      contribute: (ctx) => [{ kind: "dependency", name: "resend", version: ctx.version("resend") }]
    })
  ]
})
```

What a vibe coder sees for `vite-web`, after picking Convex:

```text
◇  Add localization?   Yes
◇  Which library?      Lingui
◇  Add a database?     Yes
◇  Which one?          Convex
◇  Add sign-in?        Yes
│
◆  Which provider?
│  ○ Better Auth (Needs Drizzle or Prisma)
│  ● Clerk  Hosted sign-in
└
```

## The API

Changed and new types. Types not listed here, such as `TargetManifest`, `PointDefinition` and the contexts, are as they
are in `src/manifest/types.ts` today.

```ts
import type { z } from "zod"
import type {
  ContributeContext,
  Contribution as CurrentContribution,
  Migration,
  PackRecord,
  PointDefinition,
  ResolveContext,
  TargetManifest
} from "./types.js"

// Versions

/** How a catalog writes a pin that's an exact version. A pin that's already a range is written as it is. */
export type RangeStyle = "exact" | "caret" | "tilde"

// Contributions: two kinds change

export type Contribution =
  | Exclude<CurrentContribution, { kind: "env" } | { kind: "command" }>
  | {
      kind: "env"
      name: string
      scope: "server" | "client" | "build"
      secret: boolean
      required: boolean
      description: string
      example?: string
      /** Where to get a value, such as the provider's dashboard. An https URL. */
      help?: string
    }
  | {
      kind: "command"
      run: string
      when: "after-install" | "after-apply"
      why: string
      /** A setup step the CLI runs when the user agrees, such as `pnpm db:push`. Without it, the command is listed. */
      setup?: boolean
    }

// Add-ons

/** An add-on id, or `provides:<name>` for any add-on that provides it. */
export type AddonReference = string

export interface AddonManifest<S extends z.ZodType = z.ZodType> {
  /** Namespaced id, such as `@buildkit/i18n`. `npm:` ids are bare add-ons, made by the engine. */
  id: string
  version: string
  title: string
  description: string
  /** Typed data other add-ons read with `ctx.provided()`, keyed by capability, such as `orm` or `database`. */
  provides?: Record<string, unknown>
  /** Pulled in with this add-on (ids), or needed from another (`provides:<name>`). */
  requires?: AddonReference[]
  /** Never installed together. `provides:<name>` means any other add-on that provides it. One side is enough. */
  conflicts?: AddonReference[]
  /** A combination add-on: selected when every reference is selected, removed when one isn't. Never asked about. */
  joins?: AddonReference[]
  /** The ranges of packages this add-on is written for, such as `{ "drizzle-orm": ">=0.45 <1" }`. */
  packages?: Record<string, string>
  after?: string[]
  points?: PointDefinition[]
  options?: S
  ask?: string[]
  supports?(ctx: ResolveContext<z.infer<S>>): true | string
  contribute(ctx: ContributeContext<z.infer<S>>): Contribution[]
  migrations?: Migration[]
  nextSteps?(ctx: ContributeContext<z.infer<S>>): string[]
}

/** A bare add-on: one package at the catalog's pin, and nothing else. Recorded as `npm:<name>`. */
export interface PackageAddon {
  npm: string
  dev?: boolean
  /** Defaults to the package name. */
  title?: string
  description?: string
}

/** An add-on a template installs or offers: an id, `npm:<name>` for a bare add-on, or a bare add-on with details. */
export type AddonRef = string | PackageAddon

// Questions

/** One choice in a question. `hint` is the line beside it, defaulting to the add-on's description. */
export type Choice = string | { addon: string; label?: string; hint?: string } | (PackageAddon & { hint?: string })

/** When a question is asked, by what the required add-ons and earlier answers select. */
export interface Condition {
  selected?: AddonReference[]
  notSelected?: AddonReference[]
}

interface QuestionShape {
  /** Unique in the template. It's the flag (`--database`) and the name `add database` answers. */
  id: string
  /** A noun for messages, `catalog --json` and the gallery, such as "Database". */
  title: string
  /** The pick, such as "Which ORM?". Not asked when only one choice is available. */
  choose?: string
  /** In order. */
  choices: Choice[]
  when?: Condition
}

/** A required question has no yes or no. An optional one asks `question` first. */
type Asking = { required: true; question?: string } | { required?: false; question: string }

/** `one` is a select (radio buttons). `many` is a multi-select of at least one (checkboxes). */
type Picking = { pick: "one"; default?: string } | { pick: "many"; default?: string[] }

/** A question: yes or no unless it's required, then which. `default` preselects, and makes yes the first answer. */
export type QuestionDefinition = QuestionShape & Asking & Picking

/** A catalog question in a template, with what this template changes. */
export interface QuestionUse {
  use: string
  choices?: Choice[]
  default?: string | string[]
  required?: boolean
  when?: Condition
}

// Templates

export interface Gallery {
  tags?: string[]
  /** An https URL, or a path in the catalog's or pack's package, such as `gallery/saas.png`. */
  image?: string
  links?: { docs?: string; demo?: string; source?: string }
}

interface TemplateFields {
  id: string
  title: string
  description: string
  /** Modes offered, asked when there's more than one. Defaults to the parent's, then all the target's. */
  modes?: string[]
  /** Installed every time, never asked about. Added to the parent's. */
  required?: AddonRef[]
  /** Asked in order. An id uses a catalog question. A parent's question with the same id is replaced in place. */
  questions?: (string | QuestionUse | QuestionDefinition)[]
  /** Question ids and required add-ons the parent has that this template leaves out. */
  omit?: string[]
  gallery?: Gallery
}

/** A template names its target, or extends another template and inherits it. */
export type TemplateManifest = TemplateFields &
  ({ target: string; extends?: undefined } | { extends: string; target?: undefined })

// Answers, presets and the catalog

export interface Answers {
  template: string
  mode?: string
  name?: string
  /** Each question's chosen add-on ids, `[]` for no. An unanswered question takes its default. */
  questions?: Record<string, string[]>
  /** Add-ons no question offers, added as `add` would add them. */
  extra?: string[]
  options?: Record<string, Record<string, unknown>>
  adopt?: boolean
}

export interface PresetManifest {
  id: string
  title: string
  answers: Omit<Answers, "name">
}

export interface CatalogManifest {
  id: string
  version: string
  facets: readonly string[]
  /** Package pins: an exact version or an npm range, such as `19.3.1`, `^19.3.1` or `~0.45.4`. */
  versions?: Record<string, string>
  /** How exact pins are written into `package.json`. Defaults to `exact`. */
  range?: RangeStyle
  targets: TargetManifest[]
  templates: TemplateManifest[]
  /** Questions templates use by id. */
  questions?: QuestionDefinition[]
  addons: AddonManifest[]
  presets?: PresetManifest[]
  packs?: Record<string, PackRecord>
}

/** A template package's default export. It can extend the catalog's templates and use its questions. */
export interface TemplatePack {
  extends: { catalog: string; versions: string }
  templates: TemplateManifest[]
  addons?: AddonManifest[]
  /** Ids can't be the catalog's. */
  questions?: QuestionDefinition[]
  /** Pins for packages the catalog doesn't pin. It can't change the catalog's. */
  versions?: Record<string, string>
}

/** An add-on package's default export, for `add <package>`. */
export interface AddonPack {
  extends: { catalog: string; versions: string }
  /** Ids start with `<package>/`. */
  addons: AddonManifest[]
  versions?: Record<string, string>
}

// Settings: one new field

/** New in `ProductSettings`: what the setup step offers besides add-ons' setup commands. */
export interface SetupSettings {
  /** Offer to install dependencies. Defaults to true. */
  install?: boolean
  /** Offer to create a git repository with a first commit. Defaults to true. */
  git?: boolean
  /** Runs the install. Defaults to the package manager that ran the CLI, then pnpm. */
  packageManager?: "pnpm" | "npm" | "yarn" | "bun"
}

// Helpers

export declare function defineAddon<S extends z.ZodType = z.ZodObject<Record<string, never>>>(
  manifest: AddonManifest<S>
): AddonManifest<S>
export declare function defineQuestion(question: QuestionDefinition): QuestionDefinition
export declare function defineTemplate(manifest: TemplateManifest): TemplateManifest
export declare function definePreset(manifest: PresetManifest): PresetManifest
export declare function defineCatalog(manifest: CatalogManifest): CatalogManifest
export declare function definePack(pack: TemplatePack): TemplatePack
export declare function defineAddonPack(pack: AddonPack): AddonPack
export declare function defineTarget(manifest: TargetManifest): TargetManifest
export declare function defineSettings(input: { product: string; setup?: SetupSettings }): {
  product: string
}

// What the wizard, the dashboard and agents read

export interface ChoiceDescription {
  /** An add-on id, or `npm:<name>`. */
  id: string
  label: string
  hint?: string
}

export interface QuestionDescription {
  id: string
  title: string
  question?: string
  choose?: string
  pick: "one" | "many"
  required: boolean
  default: string[]
  when?: Condition
  /** Those that support the mode. Which can be picked depends on earlier answers: see `availableChoices`. */
  choices: ChoiceDescription[]
}

export interface AvailableChoice extends ChoiceDescription {
  /** Why it can't be picked now, such as "Needs a database" or "Can't be used with Convex". */
  disabled?: string
}

export interface TemplateDescription {
  id: string
  title: string
  description: string
  extends?: string
  modes: { id: string; title: string }[]
  required: ChoiceDescription[]
  questionsByMode: Record<string, QuestionDescription[]>
  /** With `stack`: the titles of what a project gets with every default answer, in the first mode. */
  gallery: Gallery & { stack: string[] }
}

/** A template's questions in one mode, after `extends`, `use` and `omit`, in the order they're asked. */
export declare function templateQuestions(
  catalog: CatalogManifest,
  template: string,
  mode: string
): QuestionDescription[]

/**
 * Whether the question is asked, given the answers so far, and which of its choices can be picked. A question with no
 * choice available, or whose `when` doesn't hold, isn't asked.
 */
export declare function availableChoices(
  catalog: CatalogManifest,
  answers: Answers,
  question: string
): { asked: boolean; choices: AvailableChoice[] }

/** Whether a string is an npm range the engine understands, such as `^1.2.0`, `~1.2` or `>=1 <3`. */
export declare function isValidRange(range: string): boolean

/** Something only the user can answer. Each becomes a decision whose every choice is a complete request. */
export type ResolveIssue =
  | { kind: "choose-mode"; template: string; modes: string[] }
  | { kind: "choose"; question: string; candidates: string[] }
  | { kind: "choose-provider"; capability: string; by: string; candidates: string[] }
  /** With `capability`, the two provide the same thing, so the decision offers to replace one with the other. */
  | { kind: "conflicts"; addon: string; other: string; capability?: string }
```

### Add-ons

| Field       | Change    | Rule                                                                                                                                                                                                                                                                              |
| ----------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slot`      | Removed   | A question lists its choices. "Only one of these" is `conflicts`                                                                                                                                                                                                                  |
| `provides`  | Unchanged | Keys are capabilities, such as `orm`, `database` or `auth`. Values are data other add-ons read with `ctx.provided()`                                                                                                                                                              |
| `requires`  | Changed   | Add-on ids, which are pulled in, and `provides:<name>`, which another add-on must satisfy. `slot:<id>` is removed                                                                                                                                                                 |
| `conflicts` | Changed   | Also `provides:<name>`: any **other** add-on that provides it. The check runs both ways, so one side declaring it is enough. Drizzle's `conflicts: ["provides:orm"]` keeps Prisma out, and a new ORM add-on from anyone conflicts with Drizzle without saying so                  |
| `joins`     | New       | Makes a combination add-on: selected when every reference (ids or `provides:`) is selected, and removed when one isn't. Never asked about, never named in a template, never added by name. Its `by` in the lock lists the add-ons it joins. It can't have `requires` or `options` |
| `packages`  | New       | The ranges of packages this add-on is written for. Catalog CI checks each pin fits                                                                                                                                                                                                |

Add-ons that conflict over a capability are a swap, not an error: `add prisma` on a Drizzle project plans a decision
"Drizzle is your database. Replace it with Prisma?", whose choice is the same request with `--replace drizzle`. The noun
is the title of the template's question that offers both, or the capability's name when none does. Until phase B adds
questions it's always the capability: "Drizzle is your orm."

The swap is offered only on `add`, and only when nothing else requires the add-on it replaces. An upgrade, a sync or a
config that runs into the conflict prints the `add … --replace …` command instead, because carrying `--replace` through
an upgrade would need a new field on the intent.

`ctx.selected(id)` and `ctx.provided(name)` stay. Use them for a line or two that differs. Use a combination add-on when
the glue has files of its own, so each pair is planned, tested and removed on its own.

### Bare add-ons

A package that needs no files, scripts or wiring doesn't need `defineAddon`. A template names it as `npm:<package>`, or
as `{ npm, dev?, title?, description? }` for a dev dependency or a title. The engine makes the add-on when it loads the
catalog: id `npm:<package>`, version `0.0.0`, one `dependency` contribution at the catalog's pin.

- **The version comes from `versions`.** A bare add-on with no pin is a catalog error, so every template in a catalog
  agrees on one version of a package. Ranges inline (`npm:zod@^4`) aren't supported.
- **On the command line it's the package name:** `add zod`, `--with zod`. `npm:zod` is the id in manifests, the config
  and the lock.
- **The details are the last ones seen.** When two templates give the same package different titles, the catalog check
  reports it.
- **`add <package>` for a package the catalog doesn't name** isn't a bare add-on. It's looked up as an
  [add-on package](#third-party-templates-and-add-ons), and when it isn't one, the error says to use the package
  manager.

### Questions

A question has an `id`, a `title`, and `pick`:

- **`pick: "one"`** is a select, which clack draws as radio buttons. `default` is one add-on id.
- **`pick: "many"`** is a multi-select of at least one, drawn as checkboxes. `default` is a list.
- **An optional question** (`required` absent or `false`) needs `question`, the yes or no. A `default` makes yes the
  first answer and preselects the default. Answering yes means picking at least one.
- **A required question** skips the yes or no.
- **`choose`** is the pick's message. It's needed when more than one choice can be available.
- **A question with one available choice** asks only the yes or no, or nothing when it's required: "Add Storybook?"
- **`choices` are in order,** and the wizard shows them in that order. Each is an add-on id, a bare add-on, or
  `{ addon, label?, hint? }`. `hint` defaults to the add-on's `description`.
- **`id`** is lowercase letters, digits and hyphens. It's the flag (`--database`), the name `add database` answers, and
  the key in answers. It can't be one of the CLI's own flags: `adopt`, `catalog-version`, `conflict`, `cwd`, `diff`,
  `dry-run`, `json`, `list`, `mode`, `name`, `out`, `plan`, `preset`, `replace`, `resolve`, `set`, `setup`, `with`,
  `without` or `yes`.
- **An add-on is offered by one question at most** in a template, so `--with sentry` knows where it goes.

**Which choices are available** is worked out from what's selected before the question: the template's required add-ons,
the answers to earlier questions (or their defaults, when unanswered), and everything those pull in through `requires`.
A choice is unavailable when:

| Reason                                                                   | The wizard shows            |
| ------------------------------------------------------------------------ | --------------------------- |
| It, or an add-on it pulls in, conflicts with something selected          | "Can't be used with Convex" |
| It needs `provides:<name>` and nothing selected or pulled in provides it | "Needs Drizzle or Prisma"   |

The names in "Needs" are the template's choices that provide the capability, or the capability's name when none do.

**A question isn't asked** when its `when` doesn't hold, or when none of its choices is available. A question that isn't
asked has no answer: its default doesn't apply and it isn't recorded as declined. `when.selected` needs every reference
to match, and `when.notSelected` needs none to. An explicit answer, from a flag or a preset, always counts, even to a
question that wouldn't be asked; the resolver still checks it, and turns a problem into a decision.

`availableChoices(catalog, answers, question)` is the one function behind this. The wizard, the dashboard and agents
call it with the answers so far.

### Templates

| Field       | Rule                                                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`    | Required, unless the template `extends` another. An extending template can't set it                                                                  |
| `extends`   | Another template's id, in the same catalog or, for a pack, the product catalog or the same pack. Chains are fine, cycles are a catalog error         |
| `modes`     | Its own, else the parent's, else every mode of the target                                                                                            |
| `required`  | Added to the parent's                                                                                                                                |
| `questions` | The parent's, in order, then this template's entries. An entry whose id the parent has replaces that question in place. A new id is added at the end |
| `omit`      | Question ids and required add-ons of the parent's to leave out                                                                                       |
| `gallery`   | Its own. Not inherited                                                                                                                               |

A `questions` entry is one of:

- **An id**, such as `"database"`: the parent's question with that id, else the catalog's.
- **`{ use, ...changes }`**: the same question, with this template's `choices`, `default`, `required` or `when`. A
  `default` must match the question's `pick`, which the catalog check confirms, since the type can't.
- **A full definition**: a question only this template asks. Its id can't be a catalog question's.

A child can't move its parent's questions. A template that needs a different order lists its questions without
`extends`, using the catalog's by id. Reordering is rare, so there's no `after`.

### Answers, presets and flags

`Answers.questions` holds each question's chosen add-on ids, with `[]` for no. `Answers.extra` holds add-ons no question
offers. `slots` and `optional` are removed. Presets use the same shape.

| Flag                          | What it does                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `--<question> <a>[,<b>]`      | Answers a question. A `one` question takes one                                                             |
| `--no-<question>`             | Answers no. Not allowed for a required question                                                            |
| `--with <add-on>`             | Adds it to the answer of the question that offers it, starting from that question's default, or to `extra` |
| `--without <add-on>`          | Takes it out of its question's answer. A question left with nothing is answered no                         |
| `--setup`, `--no-setup`       | Runs the setup steps, or doesn't ask about them                                                            |
| `--preset`, `--mode`, `--set` | Unchanged                                                                                                  |

`requestArgv` writes requests with these flags, and `--preset` plus the differences, as it does today.

`add <question>` asks one question of the project's template, as the config records it, with every choice available
given what's installed. `add database --database drizzle` answers it without asking. When the template is no longer in
the catalog, the error lists the add-ons instead.

### Versions

- **A pin is an exact version or an npm range** as npm's `semver` reads it: `^`, `~`, comparators, `x`, hyphen ranges
  and `||`. The engine's `isValidRange`, `lowestVersion` and `satisfiesRange` are thin wrappers over `semver`. Dist-tags
  such as `latest` aren't pins, because the same catalog version must make the same project.
- **`range`** says how an exact pin is written into `package.json`: `exact` (the default, and what catalogs get today),
  `caret` or `tilde`. A pin that's already a range is written as it is, so `"drizzle-orm": "~0.45.4"` stays `~` in a
  `caret` catalog. `ctx.version(name)` returns what's written.
- **`packages` on an add-on** gives the ranges it's written for. Catalog CI checks the lowest version each pin allows is
  in the add-on's range. With `--registry` it also checks the newest published version the pin allows. The lowest
  version is `semver`'s `minVersion`, so `<2` gives `0.0.0`.
- **`catalog check --registry`** (Node) asks npm for each pin of the installed catalog, so it takes no folder: plain
  `catalog check` already means "the pack in this folder", and packs can't pin versions until D1. It checks the range
  the catalog writes, such as `^19.3.1` in a `caret` catalog. It fails, with `E_INVALID_CATALOG`, when nothing published
  matches, and when the newest match is younger than `--min-age` days (default 1), the rule Buildkit already follows for
  its pins. It's for CI and release, not for every plan.
- **Upgrades** change pins like any shared key: a key the engine wrote and you haven't changed moves to the new pin. One
  you changed is a conflict, which `keep-current` answers. A catalog that changes its `range` style rewrites the keys it
  wrote the same way.
- **`isValidRange`** and **`lowestVersion`** are exported, beside `satisfiesRange`.

### Setup steps

After `create` applies, the wizard offers the setup steps in one multi-select, all preselected:

```text
◆  Run setup now?
│  ◼ Install dependencies   pnpm install
│  ◼ Create the tables      pnpm db:push
│  ◼ Create a git repository with a first commit
└
```

- **The steps, in order:** `after-apply` setup commands, then the install, then `after-install` setup commands, then
  `git init` and a commit of everything. Each add-on's `command` contribution with `setup: true` is a step, labelled by
  its `why`. Commands without `setup` stay in the next steps, as today.
- **Settings decide the rest:** `setup.install` and `setup.git` (both default true) and `setup.packageManager`, which
  defaults to the package manager that ran the CLI (from `npm_config_user_agent`), then pnpm. Commands run as the add-on
  wrote them.
- **They run with clack's `tasks`**, one at a time, in the project folder, after the secrets file is written. A step
  that fails stops the rest: the CLI prints its output and lists the steps left as next steps, and exits with code 6,
  "applied, setup failed". The project is applied either way.
- **Without a terminal** they don't run unless `--setup` is given. `--json` never runs them; the plan's `commands`
  include `setup: true` so another door can offer them.
- **A template package's commands** are its author's code. They run only after the trust confirmation the CLI already
  asks for a package's template.

### Gallery metadata

`gallery` on a template holds `tags` (lowercase, hyphenated), an `image` and `links` (`docs`, `demo`, `source`, each an
https URL). `image` is an https URL or a path in the catalog's or pack's npm package. `catalog check` confirms the file
is in the package.

`catalog --json` describes each template's `gallery`, with a derived `stack`: the titles of the required add-ons and of
every default answer, in the first mode, without combination add-ons. A platform builds its template gallery from that
JSON, or by importing `describeCatalog`, with no list of its own to keep in step.

### Third-party templates and add-ons

Template packages ([scaffolder-template-packages.md](scaffolder-template-packages.md)) gain:

- **`extends` on their templates**, naming a product catalog template. `shop` extends `saas` and adds Stripe.
- **The catalog's questions**, by id, and **`questions`** of their own. A pack question's id can't be a catalog
  question's id or a CLI flag.
- **`versions`** for packages the catalog doesn't pin. A pack that pins a package the catalog pins is refused, so a pack
  can't change the platform's versions. Bare add-ons in a pack use these pins.
- **Gallery images** inside the pack's package.

**Add-on packages** are new, the "next" the template packages plan named. `acme add @shopco/resend` installs a package
whose default export is `defineAddonPack({ extends, addons, versions? })`:

- It's found the way template packages are: a scoped name, or `npm:<name>`, that isn't an add-on in the catalog. It's
  installed into the user's cache with its integrity, recorded in the lock's `packs`, and checked against the catalog
  before planning. The plan says where it came from, and the CLI asks before applying.
- Its add-on ids start with `<package>/`. It can't add targets, points, questions or templates.
- Later commands load it from the lock, as they load template packs. `upgrade` moves it to its newest version whose
  `extends` range includes the installed catalog.

### The wizard

The order: template, project name, mode, then **each question in order**, then the options each chosen add-on lists in
`ask`, then env vars, then the plan and one confirmation, then the setup steps.

| Question                                     | Prompt                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Optional                                     | `confirm(question)`, yes first when there's a default. No answers `[]`                                          |
| One available choice                         | Nothing more: that choice is the answer                                                                         |
| `pick: "one"`                                | `select(choose)`, starting on the default when it's available                                                   |
| `pick: "many"`                               | `multiselect(choose, { required: true })`, with the available defaults checked                                  |
| Choices                                      | In order, `hint` beside each. An unavailable one is `disabled`, with the reason as its hint                     |
| Not asked (its `when`, or nothing available) | Skipped without a word                                                                                          |
| An env var with `help`                       | The message gets a second line, "Get one at <url>". The next steps say it too, when the value is left for later |

The `Prompter` gains `disabled?: boolean` on `SelectOption` and `required?: boolean` on `multiselect`, both of which
clack 1.8 has. The scripted test prompter records both.

### Plans and decisions

- **Resolver issues:** `choose-slot` becomes `choose` (a required question with no default and more than one available
  choice). `slot-taken` folds into `conflicts`, whose `capability` says when it's a swap. `choose-provider` is
  unchanged.
- **Combination add-ons** are expanded before the conflict checks, so a combination's own conflicts and the capabilities
  it provides count. They're ordered after the add-ons they join. When an `add`, a `--replace` or an upgrade changes the
  selection, they're added or removed with it, and the plan lists them as pulled in, with what joined them.
- **A template that gains a question** in a catalog upgrade doesn't ask it during `upgrade`. The plan has a
  `new-question` notice: "The template now asks: Add telemetry? Run `acme add telemetry` to answer it."
- **`add <combination add-on>`** is refused by the planner, so every way in gets the same usage error: "Better Auth
  tables for Drizzle is added with Better Auth and Drizzle."

### `catalog --json`

`CatalogDescription.templates[]` becomes `TemplateDescription`: `questionsByMode` holds `QuestionDescription[]` in
order, `required` is a list of choices, and `gallery` has the derived `stack`. `addons[]` gains `provides` (the names),
`requires`, `conflicts` and `joins`, so another door can explain a choice without the engine. `slots` is removed.

### Catalog checks

`checkCatalog` keeps today's checks and adds:

| Area      | A problem when                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Versions  | A pin isn't an exact version or a range the engine reads                                                                            |
|           | An add-on's `packages` names a package the catalog doesn't pin, gives an invalid range, or doesn't contain the pin's lowest version |
|           | A bare add-on's package isn't pinned, or two templates give it different details                                                    |
|           | A pack pins a package the catalog pins                                                                                              |
| Add-ons   | `conflicts` or `requires` names `provides:<name>` no add-on provides, or an id that isn't in the catalog                            |
|           | A combination add-on joins fewer than two references, has `requires` or `options`, or is offered, required or preset                |
| Questions | An optional question has no `question`, or one with several choices has no `choose`                                                 |
|           | A question has no choices, offers an add-on that isn't in the catalog, or a default it doesn't offer                                |
|           | A `one` question preselects more than one, or a `use` gives a default that doesn't match `pick`                                     |
|           | A `many` question offers two add-ons that conflict                                                                                  |
|           | A template offers one add-on in two questions, or asks a question whose choice needs a capability only a later question provides    |
|           | A question id isn't lowercase letters, digits and hyphens, is a CLI flag, or a template definition reuses a catalog question's id   |
| Templates | A template has no target and no parent, extends one that doesn't exist, or extends in a cycle                                       |
|           | `omit` names something the parent doesn't have                                                                                      |
| Gallery   | A tag isn't lowercase and hyphenated, a link isn't https, or an image path isn't in the package                                     |

**The matrix** (`matrix: true`) plans pairs of answers per template and mode, as today. A `one` question is one factor,
whose values are its choices plus no when it's optional. A `many` question is one in-or-out factor per choice; a row
that leaves a required `many` question empty gets its first choice. A combination add-on is covered whenever its add-ons
are a pair, and rows the engine turns down are skipped, as today.

### Config and lock

- `addons` in the config still lists the explicitly chosen add-ons. Combination add-ons aren't listed, like add-ons
  pulled in by `requires`. The lock records them with `explicit: false` and `by` set to the add-ons they join.
- `declined` holds `question:<id>` for each question answered no, and the add-on ids a `many` question offered and the
  user left out. It replaces `slot:<id>`.
- Reading a config or a lock with `slot:<id>` treats it as `question:<id>` and writes the new form on the next apply.
  The lock's `schemaVersion` stays 1.
- A project made before this change keeps working: its add-ons are in `addons`, and `add <question>` uses its template's
  new questions.

### Removed

`defineSlot`, `SlotDefinition`, `SlotPolicy`, `CatalogManifest.slots`, `AddonManifest.slot`, `slot:<id>` in `requires`,
`TemplateManifest.optional` and `TemplateManifest.slots`, `Answers.slots` and `Answers.optional`, `SlotQuestion`,
`TemplateQuestions.slots` and `.optional`, `CatalogDescription.slots`, and the `choose-slot` and `slot-taken` issues.
`--<slot>` and `--no-<slot>` keep working when the template has a question with that id, which is how Buildkit's and
SpawnKit's catalogs migrate.

## Acceptance cases

The engine's tests cover each of these, from the fixture catalog, which moves to questions and gains the example's
shape. The [reference model](#validation) passes all of them.

1. The example catalog has no problems.
2. `vite-web` asks localization, database, auth, telemetry and developer tools, in that order. `saas` asks the first
   four, with database and auth required and defaulting to Drizzle and Better Auth, keeps the catalog's hints, and
   requires Vite+, Vitest and zod.
3. With Convex picked, auth is asked, Better Auth is unavailable with "Needs Drizzle or Prisma", and Clerk is available.
   With no database, the same. With Drizzle, both are available.
4. A question with `when: { selected: ["provides:database"] }` isn't asked after "no" to the database, and is asked
   after Prisma.
5. Drizzle and Better Auth select the Better Auth and Drizzle combination, and not the Prisma one. The `saas-prisma`
   preset selects the Prisma one, answers no to telemetry's default, and keeps Lingui.
6. Drizzle with Prisma added is a `conflicts` issue with capability `orm`. Convex with Prisma conflicts though only
   Convex declares it. Drizzle alone doesn't conflict with itself.
7. Better Auth added with no database is a `choose-provider` issue for `orm`, offering Drizzle and Prisma.
8. `saas` with no answers plans Drizzle, Better Auth and zod. A required question with no default is a `choose` issue
   with every available choice.
9. A pack's `shop` template extends `saas`, its Stripe add-on needs the catalog's database, and the merged catalog has
   no problems. Answering no to its inherited required database is a usage error.
10. In a `caret` catalog, `react` 19.3.1 is written `^19.3.1`, a `~` pin stays `~`, and in an `exact` catalog 19.3.1
    stays 19.3.1.
11. The checks report: a pin that isn't a range, an add-on whose `packages` the pin doesn't fit, a bare add-on with no
    pin, a required combination add-on, a `many` question with two conflicting add-ons, a default the question doesn't
    offer, an add-on offered twice, and a question asked before the one that provides what its choice needs.

Beyond the model, the engine's tests also cover: the wizard's prompts for each row of the wizard table, with the
scripted prompter; every flag in the flags table, and `requestArgv` writing them back; `add <question>`, the swap
decision and `add <combination add-on>`; the `new-question` notice on upgrade; reading `slot:` from an old config and
lock; setup steps running in order, stopping at a failure with exit code 6, and not running without a terminal or with
`--json`; `catalog check --registry` against an injected `runCommand`; and template and add-on packages through the
package store, as the template package tests do.

## Validation

This plan was checked on 2026-11-02, against the engine at `main` (`@buildkitgg/scaffolder` 0.6.0):

- **The API and the example type-check** with the repo's TypeScript 7.0.2, `strict`, `exactOptionalPropertyTypes` and
  `noUncheckedIndexedAccess`, and zod 4.6.7. Unchanged types came from today's `src/manifest/types.ts`.
- **Mistakes are type errors:** an optional question without `question`, a list as a `one` question's default, a single
  id as a `many` question's default, a template with neither `target` nor `extends`, one with both, and an unknown
  `pick`.
- **A reference model** of template expansion, bare add-ons, availability, selection with `provides:` conflicts and
  combination add-ons, range styles and the new checks, about 480 lines on the engine's own `satisfiesRange`, passes the
  11 acceptance cases above with Node's test runner. Writing it settled one case: "no" to a required question stays a
  usage error, as it is today, not a decision.
- **Every engine function this plan changes exists today** where the tasks name it, and clack 1.8.1, the version the
  engine uses, has `disabled` options, `required` multi-selects and `tasks`.

## Tasks

Each task is one pull request with its tests, docs and change file. Phase A is additive and ships as a minor release.
Phases B to D change the API and ship together as the next minor, marked breaking in its change file, with a migration
section in the README. Phase E moves the catalogs once that release is on npm.

### Phase A: additive engine work

Done on 2026-11-02, and waiting on a release: A1 in [#98](https://github.com/betterapps-hq/buildkit/pull/98), A2 in
[#99](https://github.com/betterapps-hq/buildkit/pull/99), A3 in
[#100](https://github.com/betterapps-hq/buildkit/pull/100) and A4 in
[#101](https://github.com/betterapps-hq/buildkit/pull/101). The tasks below say what was built, where it differs from
what was first planned.

**A1. Version ranges.** `upgrade/semver.ts`: `isValidRange`, `lowestVersion` and `satisfiesRange` over npm's `semver`.
`CatalogManifest.range`. `plan/render.ts` and `plan/plan.ts`: `ctx.version()` returns the written value.
`AddonManifest.packages`. `resolve/check.ts`: the version rows of the checks. `node/catalogs.ts` and `cli/commands.ts`:
`catalog check --registry [--min-age <days>]`, through the store's `runCommand`. Tests: each range style, ranges kept as
written, each check, the registry check with an injected command, an upgrade that changes a pin.

**A2. Conflicts by capability.** `resolve/resolve.ts`: `conflicts` accepts `provides:<name>`, checked both ways, never
against the add-on itself; the `conflicts` issue gains `capability`. `plan/decisions.ts`: a conflict with a capability
is the swap decision on `add`, and anywhere else a printed `add … --replace …` command. `resolve/check.ts`: allow
`provides:` in `conflicts`, still not in `after`. Tests: acceptance case 6, and `add` swapping through the decision's
argv.

**A3. Combination add-ons.** `AddonManifest.joins`. `resolve/resolve.ts`: before the conflict checks, add every
combination whose references all match, until nothing changes, and order it after what it joins; `by` lists them.
`plan/plan.ts`: `add`, `--replace` and `upgrade` add and remove them with the selection, and the planner refuses
`add <combination>`. `resolve/check.ts`: the combination rows. `checkCatalog`'s matrix covers them through pairs. Tests:
the fixture catalog's add-ons in place of acceptance case 5, which needs questions and moves to B3; removal on
`--replace`; and the lock's `by`.

**A4. Env help links.** `Contribution` `env` gains `help`. `plan/render.ts` passes it into `EnvVar`. `cli/wizard.ts`
`askEnv` adds "Get one at <url>", and the next steps for an unset variable say it. Add-ons build their env entries in
code, so `help` being https is checked on rendered plans: catalog CI catches a bad link only in add-ons its presets and
matrix select. Tests: the wizard's message, the next step.

### Phase B: questions

Done on 2026-11-03: B1 to B5 in [#107](https://github.com/betterapps-hq/buildkit/pull/107), B6 to B9 in
[#117](https://github.com/betterapps-hq/buildkit/pull/117), B10 in
[#116](https://github.com/betterapps-hq/buildkit/pull/116) and B11 in
[#131](https://github.com/betterapps-hq/buildkit/pull/131).

**B1. Types and helpers.** `manifest/types.ts`: everything in [The API](#the-api), the removals, and `Choice`,
`Condition`, `QuestionDefinition`, `QuestionUse`, `Gallery`. `manifest/define.ts`: `defineQuestion`, and remove
`defineSlot`. `core.ts` exports. The fixture catalog moves to questions. Nothing else compiles until B2 to B5 land, so
B1 to B5 are one pull request.

**B2. Expansion and bare add-ons.** `manifest/catalog.ts`: `expandTemplate(catalog, id)`, which applies `extends`, `use`
and `omit` and returns the target, modes, required ids and questions; a bare add-on for every `npm:` reference, made
once when the catalog is loaded, with `lookupAddon` matching a bare add-on by its package name. Every later step reads
expanded templates. Tests: acceptance case 2, cycles, `omit`, a child replacing a question in place.

**B3. Answers to a selection.** `resolve/answers.ts`: `selectionFromAnswers` walks the expanded questions in order:
explicit answers count, unanswered asked questions take their default, a required one with no default and more than one
available choice is a `choose` issue, and declines are recorded as [Config and lock](#config-and-lock) says. `extra`
adds add-ons. Tests: acceptance cases 5, 7 and 8.

**B4. Availability.** `resolve/questions.ts`: `availableChoices` and `when`, as [Questions](#questions) describes, and
`templateQuestions` returning `QuestionDescription[]`. Tests: acceptance cases 3 and 4.

**B5. Resolver and decisions.** `resolve/resolve.ts` and `plan/decisions.ts`: remove slots, add the `choose` issue and
its decision (each choice a complete request answering the question), and keep `choose-provider`. The swap decision
takes its noun from the title of the question that offers both add-ons, in place of the capability's name. Tests: every
issue's decision applies without asking again, and the swap's wording.

**B6. The wizard.** `cli/wizard.ts`: ask the expanded questions in order as the wizard table says; `PartialAnswers`
holds `questions` and `extra`. `cli/prompter.ts`: `disabled` and `required`. `src/testing/prompter.ts` records them.
Tests: one per row of the wizard table, and cancelling at each prompt.

**B7. Flags, argv and `add <question>`.** `cli/flags.ts` and `cli/commands.ts`: dynamic flags from the template's
question ids, `--with` and `--without` as the flags table says, `add <question>` from the config's template.
`plan/argv.ts`: write answers back as flags, with presets. Tests: every flag, round trips through `requestArgv`.

**B8. Description and gallery.** `resolve/questions.ts`: `describeCatalog` with `TemplateDescription`, the derived
`stack`, and the add-ons' rules. `cli/commands.ts`: the readable `catalog` output lists each question and its choices.
Tests: the JSON for the fixture, snapshot-free.

**B9. Checks and the matrix.** `resolve/check.ts`: the question, template and gallery rows of the checks, and
`pairwiseAnswers` over questions. Tests: acceptance case 11, and the matrix on the fixture.

**B10. Config and lock.** `state/schemas.ts` and the readers: `slot:` read as `question:`, written in the new form.
`plan/plan.ts`: the `new-question` notice on upgrade. Tests: an old config and lock upgrade cleanly.

**B11. Docs and release files.** The README's concepts, the catalog example, "Templates and the wizard", the flags, and
a "Migrating from slots" section; the architecture guide; `pnpm api:update`; a breaking change file.

B2 to B5 are sequential. B6, B7 and B8 can run in parallel after B5. B9 needs B4. B10 can start after B3. B11 is last.

### Phase C: setup steps

Done on 2026-11-03 in [#125](https://github.com/betterapps-hq/buildkit/pull/125). clack's `tasks` marks every task done,
so the CLI runs each step with its own spinner, and `Prompter.tasks` is optional, so custom prompters keep working.

**C1. Setup steps.** `command` gains `setup`. `ProductSettings.setup`. `cli/scaffold.ts` and `cli/create.ts`: the
multi-select after apply, running steps with clack's `tasks`, exit code 6, `--setup` and `--no-setup`. Plans mark setup
commands in `commands`. Tests: order, a failing step, no terminal, `--json`, a template package's steps after the trust
confirmation. Needs B6.

### Phase D: third parties

Done on 2026-11-03: D1 in [#118](https://github.com/betterapps-hq/buildkit/pull/118) and D2 in
[#126](https://github.com/betterapps-hq/buildkit/pull/126). `catalog check` in an add-on package's folder runs the
catalog's checks on its add-ons; there are no templates to plan.

**D1. Template packages.** `manifest/packs.ts`: pack templates can extend catalog templates and use catalog questions;
pack `questions` and `versions`, with their checks; gallery images resolved inside the pack. Tests: acceptance case 9
through the package store. Needs B2.

**D2. Add-on packages.** `defineAddonPack`, `AddonPack`. The package store loads add-on packages for `add`; the lock's
`packs` records them; `upgrade` moves them. The template packages doc gets an "Add-on packages" section. Tests: `add` of
a fixture add-on package from a local tarball, a later `sync` from the lock, an integrity mismatch, an upgrade. Needs
D1.

### Phase E: catalogs and the site

**E1. Buildkit's catalog.** `packages/tooling/catalog`: the `app` template's slots and optional add-on become questions
with the same ids (`database`, `auth`, and `i18n`), so `--database`, `--auth` and `--no-auth` keep working. The SQL
add-on provides `database` and conflicts with `provides:database`; Better Auth requires `provides:database`. Hints on
each choice, help links on `BETTER_AUTH_SECRET`, `pnpm db:generate` as a setup step, gallery metadata, `packages` on the
add-ons that wrap a library. Pins stay exact, as phase 2 decided. Tests: the catalog's matrix and smoke tests.

Done on 2026-11-03 in [#E1](https://github.com/betterapps-hq/buildkit/pull/E1). #109 had removed the database and
sign-in add-ons and B1 to B5 had moved `i18n` to a question, so what was left: a hint on the localization choice, Lingui
ranges in the i18n add-on's `packages`, gallery tags and links on `app`, and `pnpm install` and `pnpm build` as setup
steps, with `setup.packageManager: "pnpm"` in Buildkit's settings because apps pin pnpm.

**E2. SpawnKit's catalog.** In `D:\spawn`, `packages/templates/src/scaffold`: the `physics`, `ui`, `simulation` and
`telemetry` slots become shared questions with the same ids, so `--physics rapier2d` keeps working. Telemetry becomes
`pick: "many"` if Sentry and platform telemetry can run together (see [Open questions](#open-questions)). The kits stay
presets. Tests: SpawnKit's matrix, smoke and browser suites.

**E3. The site.** `apps/site/src/sections/tooling/Scaffolder.tsx`: the template sample shows the released API: a
template with `required`, a shared question by id and one defined inline, and the wizard's lines for them. Needs the
phase B to D release on npm.

### Order

- **A1 to A4** are merged, and ship together as a minor release. Ranges and swaps help today's catalogs before questions
  land, so phase A went first.
- **B1 to B5** are one pull request, built in that order.
- **After B5**, these can run in parallel: B6, B7, B8, B9, B10 and D1.
- **C1** needs B6. **D2** needs D1.
- **B11** comes last, after B6 to B10, C1, D1 and D2, then the release.
- **E1 and E2** follow the release, in parallel. **E3** follows E1, so the site shows what Buildkit's catalog ships.

## Open questions

- **Buildkit's range style.** E1 keeps exact pins, as phase 2 decided for reproducible apps. A starter for vibe coders
  might want `caret`, so their apps take fixes without an upgrade.
- **SpawnKit's telemetry question,** `one` or `many`, in E2.
