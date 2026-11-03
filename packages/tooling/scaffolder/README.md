# @buildkitgg/scaffolder

A plan-first scaffolding engine. A product describes what projects can be made of in a **catalog**: targets, add-ons,
questions and templates. The engine turns answers into a reviewed **plan**, applies it safely, and later adds to,
changes or upgrades the project without overwriting your edits.

Requires Node.js 24 or later. Until 1.0, minor versions may change the catalog and manifest types.

```sh
npm install -g @buildkitgg/scaffolder
scaffold my-app
```

`scaffold` creates a project from Buildkit's catalog, or from any published catalog or template package. Products such
as Buildkit build their own CLI on the engine instead, and create projects with `<product> create`.

## Table of contents

- [The scaffold command](#the-scaffold-command)
- [Exports](#exports)
- [Concepts](#concepts)
- [Writing a catalog](#writing-a-catalog)
- [Templates and the wizard](#templates-and-the-wizard)
- [File ownership](#file-ownership)
- [Building a CLI](#building-a-cli)
- [Commands](#commands)
- [The JSON envelope and exit codes](#the-json-envelope-and-exit-codes)
- [Upgrades](#upgrades)
- [Template packages](#template-packages)
- [Catalog CI](#catalog-ci)

## The scaffold command

`scaffold [package][@version][#template] [folder]` fetches the package from npm into your user cache, never the project,
without running its scripts, and creates a project from it. It takes every option `create` takes: `--mode`, `--preset`,
`--name`, `--with`, `--without`, `--set`, `--adopt`, `--dry-run`, `--json` and `--yes`. npm's install scripts never run,
but the package's own code does, on your machine and with your permissions, so scaffold only from packages you trust.

- **A catalog package** exports its catalog as `catalog` or by default, and its product settings as `settings`. The
  project gets the product's file names, so the product's own CLI manages it later. Without `settings`, the files are
  named for scaffold: `scaffold.jsonc` and `.scaffold/`. With several templates, `#<template>` picks one, and in a
  terminal `scaffold` asks.
- **A [template package](#template-packages)** brings the catalog version it extends, and `scaffold` fetches that too.

A scoped name, or any name after `npm:`, is a package, as `create` reads it. Without one, `scaffold` uses
`@buildkitgg/catalog`, and its first argument is a template or, when it isn't one, the folder: `scaffold my-app` and
`scaffold app my-app` both work. `runScaffold` takes `defaultPackage` to use another catalog. A saved plan records the
catalog and template package versions it was made with, and `--plan` loads exactly those.

## Exports

| Import                             | What it has                                                                    | Runs in                           |
| ---------------------------------- | ------------------------------------------------------------------------------ | --------------------------------- |
| `@buildkitgg/scaffolder`           | `define*` helpers, the resolver, the pure planner, the envelope, state schemas | Anywhere: no file system, no git  |
| `@buildkitgg/scaffolder/edit`      | Comment-keeping edits for JSON, JSONC, YAML, line lists and `.env` files       | Anywhere                          |
| `@buildkitgg/scaffolder/edit/code` | `ensureImport` and `appendToArray` codemods on oxc's AST                       | Node and bundlers with oxc-parser |
| `@buildkitgg/scaffolder/node`      | The disk snapshot, safe apply, `recover`, plan artifacts, the catalog cache    | Node                              |
| `@buildkitgg/scaffolder/cli`       | Command builders, the generated wizard and its flags, readable output          | Node                              |

## Concepts

| Concept          | What it is                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **Catalog**      | A product's versioned package of targets, add-ons, shared questions, templates, presets and pins   |
| **Target**       | A framework and its modes, such as `web/ssr`. It provides base files and owns extension points     |
| **Template**     | What `create` offers: a target, required add-ons (never asked about) and questions, in order       |
| **Question**     | Yes or no unless it's required, then one choice or several, such as "Add a database?"              |
| **Add-on**       | A manifest whose `contribute()` returns data-only contributions, and the rules true wherever it is |
| **Bare add-on**  | One package at the catalog's pin and nothing else, named in a template as `npm:<package>`          |
| **Point**        | A typed extension point, rendered into a generated file that your code imports                     |
| **Plan**         | Operations, decisions and conflicts, with a fingerprint                                            |
| **Config, lock** | `<product>.jsonc` holds your choices; `.<product>/lock.json` holds derived state                   |

## Writing a catalog

```ts
import { defineAddon, defineCatalog, defineQuestion, defineTarget, defineTemplate } from "@buildkitgg/scaffolder"
import { z } from "zod"

const i18n = defineAddon({
  id: "@acme/i18n",
  version: "1.0.0",
  title: "Localization",
  description: "Lingui message catalogs",
  options: z.object({ locales: z.array(z.string()).default(["en"]).describe("Locales") }),
  ask: ["locales"],
  contribute: (ctx) => [
    { kind: "dependency", name: "@lingui/core", version: ctx.version("@lingui/core") },
    {
      kind: "file",
      path: "src/i18n/setup.ts",
      content: `export const locales = ${JSON.stringify(ctx.options.locales)}\n`,
      ownership: "seed"
    },
    {
      kind: "entry",
      point: "vite.plugins",
      id: "lingui",
      value: { call: { module: "@lingui/vite-plugin", export: "lingui" } }
    }
  ]
})

export default defineCatalog({
  id: "@acme/catalog",
  version: "1.0.0",
  facets: ["vite", "ssr", "spa"],
  versions: { "@lingui/core": "6.10.1", zod: "4.1.0" },
  targets: [/* defineTarget({ id, family, modes, points, base }) */],
  questions: [
    defineQuestion({
      id: "database",
      title: "Database",
      question: "Add a database?",
      choose: "Which one?",
      pick: "one",
      choices: [{ addon: "@acme/db-sqlite", hint: "A local file" }, "@acme/db-postgres"]
    })
  ],
  templates: [
    defineTemplate({
      id: "app",
      title: "App",
      description: "A web app",
      target: "web",
      required: ["@acme/lint", "npm:zod"],
      questions: [
        { use: "database", default: "@acme/db-sqlite" },
        { id: "i18n", title: "Localization", question: "Add localization?", pick: "one", choices: ["@acme/i18n"] }
      ]
    })
  ],
  addons: [i18n /* … */]
})
```

Contribution kinds: `dependency`, `script`, `env`, `file` (`owned`, `seed` or `sample`), `entry`, `json` and `yaml`
(`set`, `merge`, or `append` with an optional `key` for keyed arrays), `lines`, `command` (listed, never run) and
`notice`. Add-ons declare `provides`, `requires` (ids, which are pulled in, or `provides:<name>`, which another add-on
must satisfy), `conflicts` (ids or `provides:<name>`), `after`, `supports()` and `migrations`.

`conflicts: ["provides:orm"]` keeps out any **other** add-on that provides `orm`, so an ORM add-on can say it and still
be installed. One side declaring a conflict is enough: a new ORM from anyone conflicts with that add-on without saying
so. A conflict over a capability is a swap, not an error: `add prisma` on a project with Drizzle plans the decision
"Drizzle is your database. Replace it with Prisma?", whose choice is `add prisma --replace drizzle`. The noun is the
title of the template's question that offers both, or the capability's name when none does.

### Versions

`versions` pins each package the targets and add-ons install: an exact version, or an npm range such as `^19.3.1`,
`~0.45.4` or `>=1 <3`. Dist-tags such as `latest` aren't pins, so a catalog version always makes the same project.
`range` says how an exact pin is written into `package.json`: `exact` (the default), `caret` (`^19.3.1`) or `tilde`
(`~19.3.1`). A pin that's already a range is written as it is, and `ctx.version(name)` returns what's written.

An add-on's `packages` gives the ranges it's written for, such as `{ "drizzle-orm": ">=0.45 <1" }`, and catalog CI
checks that the lowest version each pin allows is in them. An upgrade moves a pin like any shared key: one the engine
wrote and you haven't changed takes the new value, and one you changed is a conflict that `keep-current` answers.
`isValidRange`, `satisfiesRange` and `lowestVersion` are exported.

A keyed append can say where a new item goes with `order: { after, before }`, by the keys of other items. A CI step with
`order: { after: ["format"] }` goes after the `format` step, or at the end when there's none. The order places an item
when it's added and never moves one that's there.

An add-on that differs by render model or mode branches with `match`, which runs the case for a value. A missing case is
a type error when the value is a union, and a plan error otherwise. Catalog CI finds it in each mode for the add-ons its
answer sets select, so an add-on no template offers needs its own test:

```ts
import { match, type Contribution } from "@buildkitgg/scaffolder"

const wiring = match(ctx.target.renderModel, {
  "ssr-loader": (): Contribution[] => [middleware],
  spa: (): Contribution[] => [bootstrap]
})
```

Entries name app modules without an extension (`./src/i18n/router`), and generated files import them as named.

### Combination add-ons

The glue between two choices, such as Better Auth's Drizzle adapter, is an add-on of its own with `joins`:

```ts
const betterAuthDrizzle = defineAddon({
  id: "@acme/better-auth-drizzle",
  version: "1.0.0",
  title: "Better Auth tables for Drizzle",
  description: "Better Auth's schema and its Drizzle adapter",
  joins: ["@acme/better-auth", "@acme/drizzle"],
  contribute: () => [{ kind: "file", path: "src/db/auth-schema.ts", content: "export {}\n", ownership: "seed" }]
})
```

It's selected when every reference, an id or `provides:<name>`, is selected, and removed when one isn't, so `add`,
`--replace` and `upgrade` add and remove it with the selection. It contributes after what it joins, the plan lists it as
pulled in with what joined it, and the lock records it with `explicit: false` and `by` set to those add-ons. It's never
asked about, and `add` refuses it by name. It can't have `requires` or `options`, and templates and presets can't name
it. Use `ctx.selected()` for a line or two that differs, and a combination add-on when the glue has files of its own.

## Templates and the wizard

A template names its `target`, or `extends` another template and inherits its target, modes, required add-ons and
questions. Its `required` add-ons are added to the parent's, and its `questions` follow the parent's in order: an entry
whose id the parent has replaces that question in place, and a new one goes at the end. `omit` leaves out questions and
required add-ons of the parent's. A `questions` entry is a question's id (the parent's, else the catalog's), a
`{ use, choices?, default?, required?, when? }` that changes one, or a full definition only this template asks.
`expandTemplate(catalog, id)` returns a template as every later step reads it.

A question has an `id`, which is also its flag, a `title`, `pick` (`one` or `many`) and `choices` in order. An optional
question asks `question` first, and a `default` makes yes the first answer and preselects it. A required question skips
the yes or no. `choose` asks which, when more than one choice is available. A choice is an add-on id, `npm:<package>` or
`{ npm, dev?, title? }` for a bare add-on, or `{ addon, label?, hint? }`, and its hint defaults to the add-on's
description.

Which choices can be picked follows from the add-ons' rules and what's selected before the question: the required
add-ons, the earlier answers or their defaults, and what those pull in. A choice that conflicts with something selected
shows "Can't be used with Convex", and one that needs a capability nothing provides shows "Needs Drizzle or Prisma". A
question whose `when` doesn't hold, or with nothing available, isn't asked and has no answer.
`availableChoices(catalog, answers, question)` works this out for the wizard, the dashboard and agents.

The wizard is generated from the catalog, so a new add-on or a new choice needs no CLI code. It asks, in order: the
template, the project name, the mode, each question (a confirm for the yes or no, then a select for `one` or a
multi-select for `many`, with unavailable choices disabled and their reason beside them), the options each chosen add-on
lists in `ask`, and the plan's environment variables, with a masked prompt for secrets. A required variable's example is
its default, and an optional one can be left blank. A variable's `help`, an https URL such as the provider's dashboard,
adds `Get one at <url>` to its prompt, and to the next steps when it's left for later. Then it shows the plan and asks
for one confirmation, which defaults to no. The answers go to the secrets file. Later commands ask only for required
secrets that file doesn't have yet. Required add-ons are never asked about, so their options must all have defaults.

Answers hold each question's add-ons, `[]` for no, and `extra` for add-ons no question offers. A required question with
no default and more than one available choice is a decision. The config's `declined` records `question:<id>` for each
no, and the choices a `many` question's answer left out. A config or lock from before questions records `slot:<id>`,
which is read as `question:<id>` and written in the new form on the next apply.

An upgrade doesn't ask the questions a template gains. Its plan has a `new-question` notice for each one the project has
no answer to, such as "The template now asks: Add telemetry? Run `acme add telemetry` to answer it."

Every question has a flag: `--<question> <add-on>[,<add-on>]`, `--no-<question>`, `--with <add-on>` (added to the
question that offers it, from its default, or to `extra`), `--without <add-on>`, `--mode`,
`--set <add-on>.<option>=<value>` and `--preset`. Short names drop the scope: `db-sqlite` is `@acme/db-sqlite`, and a
bare add-on is its package name, such as `zod`. `catalog --json` describes the whole questionnaire, with each template's
questions per mode and a gallery `stack`, for dashboards and agents.

## File ownership

| Class    | Examples                        | The engine may                      | Later                                       |
| -------- | ------------------------------- | ----------------------------------- | ------------------------------------------- |
| `owned`  | Generated point files           | Rewrite it while you haven't        | Regenerated. Your edit is a decision        |
| `seed`   | Starter routes, config files    | Create it once                      | Three-way merged with your edits on upgrade |
| `sample` | `AGENTS.md`, example pages      | Create it once                      | Never touched again. Your deletion persists |
| `shared` | `package.json`, `tsconfig.json` | Edit only the keys it introduced    | Merged by key. Keys you had are kept        |
| `user`   | Everything else                 | Nothing, except codemods you review | Never merged                                |

The one rule: create a path only if it's absent, and overwrite or delete only while the file still hashes to what the
engine last wrote. Anything else is a conflict, and `--yes` can't answer it. Hashes ignore line endings, a BOM and the
final newline, and writes keep each file's line endings.

## Building a CLI

```ts
#!/usr/bin/env node
import catalog from "@acme/catalog"
import { defineSettings } from "@buildkitgg/scaffolder"
import { createCli } from "@buildkitgg/scaffolder/cli"
import { runMain } from "citty"

await runMain(createCli({ name: "acme", version: "1.0.0", catalog, settings: defineSettings({ product: "acme" }) }))
```

`defineSettings` picks the product's file names: `acme.jsonc`, `.acme/` and `.env` for secrets, unless you set them.
`runCli(argv, options)` runs one command and returns its exit code, for tests and embedding tools. `runScaffold` is the
`scaffold` command, for tools that fetch a catalog package rather than install one.

Set `printWidth` to the line width of your apps' formatter. The JSON the engine writes, the config file included, is
laid out as oxfmt and Prettier lay it out with trailing commas off: short lists on one line, objects as they're written,
and `package.json` as `JSON.stringify` writes it. A formatter then leaves those files alone, so apps don't need to
exclude them. `printJson` and `jsonLayoutFor` in `@buildkitgg/scaffolder/edit` print a starter JSON file the same way.

## Commands

| Command                                       | What it does                                                         |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `create [template] [folder]`                  | Create a project, from a template or a package. `--adopt` adopts one |
| `add <add-on or question…>`                   | Add add-ons, or answer a question: `add database`. `--replace`       |
| `config`, `config get`, `config set`          | Show the config, get an option, or set options                       |
| `upgrade [--list]`                            | Move to the installed catalog version, running migrations            |
| `sync`                                        | Bring generated files and the lock in line with the config           |
| `check`                                       | Fail when generated files or the lock are out of date                |
| `status [path]`, `explain <subject>`          | What the engine manages, and who contributes a path, add-on or entry |
| `plan show <file>`                            | Show a saved plan                                                    |
| `catalog [package] [--json]`                  | Describe the questionnaire, or a template package's templates        |
| `catalog fetch <version>`, `catalog check`    | Cache an earlier catalog version, or check a package before publish  |
| `catalog check --registry [--min-age <days>]` | Check each of the catalog's pins against npm                         |
| `schema`                                      | JSON Schemas for the config, the lock and plan requests              |
| `recover`                                     | Roll back an interrupted apply                                       |

Every planning command takes `--dry-run`, `--json`, `--out [folder]`, `--plan <file>`, `--yes`, `--diff`,
`--resolve <id>=keep-current|take-incoming|file:<path>` and `--conflict markers`. Without a terminal, a command plans
and writes nothing unless you pass `--yes` or apply a reviewed plan with `--plan`. A reviewed plan applies only if the
project hasn't changed since; applying it twice is a no-op. It records the template packages it was made with, and
applying it loads those exact versions, so a newer release never runs first. `--cwd` sets where the project is for every
command, and `create`'s folder is relative to it. `init` still runs `create`, unlisted, until 0.7.

## The JSON envelope and exit codes

With `--json`, the commands that plan or change the project (`create`, `add`, `config set`, `upgrade`, `sync`, `check`,
`plan show`, `catalog fetch` and `recover`) print one JSON envelope: `status`, `fingerprint`, `operations` (path,
action, class and line counts), `decisions` (each choice with its `request` and `argv`), `conflicts`, `packages`, `env`,
`commands`, `migrations`, `notices`, `nextSteps` and `error`. Files that may hold secrets show no contents or line
counts.

The commands that only read print their own JSON instead:

| Command      | `--json` prints                                                                |
| ------------ | ------------------------------------------------------------------------------ |
| `config`     | The config, as an object                                                       |
| `config get` | The add-on's options or the option's value, or `null`                          |
| `status`     | `{ catalog, files, deleted }`: each file's path, class, state and contributors |
| `explain`    | An object whose `kind` is `path`, `addon`, `entry` or `unknown`                |
| `catalog`    | The questionnaire: each template's questions, by mode                          |
| `schema`     | `{ config, lock, request }`, each a JSON Schema                                |

When any command fails, it prints the envelope with `status: "error"`.

| Code | Meaning                       |
| ---- | ----------------------------- |
| 0    | planned, applied or unchanged |
| 1    | needs a decision              |
| 2    | usage or internal error       |
| 3    | conflict                      |
| 4    | drift: the project changed    |
| 5    | locked or interrupted         |
| 130  | cancelled                     |

## Upgrades

`upgrade` renders the old baseline with the catalog version the lock records, renders the new one, and merges: seeds
three-way, shared files by key, generated files by hash. Run `catalog fetch <version>` to cache an old version for
offline use; without it, edited seeds need a decision. The cache is in your user cache folder, never in the project, so
a cloned repository can't supply catalog code for the CLI to run. A product whose catalog isn't published sets
`seedBases: "stored"` in `defineSettings`, which keeps each seed's generated text in the lock to merge against instead.
Migrations run when an add-on's version moves past theirs: option rewrites, codemods, package bumps, and agent tasks
that are only listed.

## Template packages

Anyone can publish templates for a product's catalog as an npm package, and the product's CLI installs one by name:
`npx <cli> create @acme/tower-defense my-game`, or `scaffold @acme/tower-defense my-game` without the product's CLI. A
scoped name, or any name after `npm:`, is a package. Add a version or a range (`@acme/tower-defense@^2`), and `#<id>` to
pick one of several templates (`@acme/starters#tower`). Built-in template ids can't look like a package, so a typo is
never fetched.

A template package's default export is a pack:

```ts
import { definePack } from "@buildkitgg/scaffolder"

export default definePack({
  extends: { catalog: "@acme/catalog", versions: "^1.0.0" },
  templates: [{ id: "tower", title: "Tower defense", description: "Waves, towers and a path", target: "web" }],
  addons: [/* ids start with "@acme/tower-defense/" */]
})
```

- **It extends one catalog.** Its templates and add-ons use the catalog's targets, questions and points, and the
  catalog's add-ons stay available to `add`. It can't add targets or points, or replace anything the catalog has.
- **Ids.** A template is recorded as `<package>#<id>`, and its add-on ids start with `<package>/`.
- **Compatibility.** The engine refuses a pack whose `versions` range doesn't include the installed catalog.
- **Checks.** The engine merges the pack into the catalog and runs `checkCatalog` before planning. Run `catalog check`
  in the package's folder, after building it, to plan every option set of its templates before you publish.

npm installs packages into the user cache folder, never the project, without running their scripts. The lock records
each package's version and integrity, and later commands load that copy and refuse one that doesn't match. Only the
package itself is pinned: npm resolves its dependencies' ranges again when it installs it into a new cache, so a pack
that needs exact dependencies publishes an `npm-shrinkwrap.json`, which npm follows. `upgrade` moves each package to its
newest version that works with the installed catalog. The plan says the template comes from a package and not from the
product, because applying it runs the package author's code.

## Catalog CI

`checkCatalog(catalog, { matrix: true })` reports broken references, templates that don't expand, questions without
their `question` or `choose`, defaults a question doesn't offer, an add-on offered twice, a `many` question offering
add-ons that conflict, a choice that needs what only a later question provides, bare add-ons without a pin, required
add-ons with options that lack defaults, unregistered facets, pins that aren't versions or ranges, add-ons whose
`packages` a pin doesn't fit, gallery tags and links, and any pair of answers that fails to plan.

`catalog check --registry` runs the installed catalog's checks, then asks npm for each pin. It fails when nothing
published matches a pin, when the newest match is younger than `--min-age` days (default 1), and when an add-on's
`packages` doesn't include the newest match. It's for CI and releases, not for every plan.
`checkRegistry(catalog, store)` in `@buildkitgg/scaffolder/node` runs it from a script.

`pairwiseAnswers(catalog, template, mode)` gives the answer sets it plans: a covering array, in which every pair of
values of every two questions appears in at least one set, built greedily and the same every time. A product's smoke
tests can generate and build those sets. `requestArgv(request, { catalog, preset })` turns one into the CLI command.
With the catalog, it writes `--without` for an add-on the template selects by default and the request leaves out. Given
a preset for the request's template, it writes `create --preset <id>` plus what differs from the preset, when the
request answers every question the preset does; a question left to the template's default can't be written as a
difference.

See [the architecture guide](docs/README.md) to work on the engine itself.
