# Scaffolder phase 2: Buildkit's catalog and the `buildkit` CLI

Plan for phase 2 of the migration path in [scaffolder-research.md](scaffolder-research.md) §6.4: Buildkit's own catalog,
and the `buildkit` CLI on `@buildkitgg/scaffolder`. Phase 0 built the engine
([scaffolder-phase-0.md](scaffolder-phase-0.md)), and phase 1 moves SpawnKit onto it
([scaffolder-phase-1.md](scaffolder-phase-1.md)).

**Status (2026-10-29):** merged in #67, with the engine changes it needed in #68 (`@buildkitgg/scaffolder` 0.4.0, on
npm). `@buildkitgg/catalog` and `@buildkitgg/cli` 0.1.0 wait for their first publish by hand, as every new package does.

## Owner decisions (2026-10-29)

| Decision                                                                                                                             | What it changes                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| **Two packages:** `@buildkitgg/catalog` holds the manifests, and `@buildkitgg/cli` is a thin `buildkit` bin on the engine's `runCli` | Both live in `packages/tooling/`, beside the scaffolder |

## Done when

A Buildkit app inits, adds i18n, and upgrades.

- `checkCatalog(catalog, { matrix: true })` passes in catalog CI.
- `buildkit init`, `add i18n` and `upgrade` from an earlier catalog version pass through `runCli` against a temp folder.
- The smoke test generates the base app in both modes, and localization in both modes, then installs, checks, lints,
  format-checks, builds and type-checks each one, and requests pages from the built server.
- `pnpm verify` passes.

## Packages

| Package               | Contents                                                                                                                 | Build                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `@buildkitgg/catalog` | The target, template, questions and add-ons; `settings` for Buildkit's file names; starter files in `templates/`         | `tsc`. Exports `catalog` (also the default export) and `settings`     |
| `@buildkitgg/cli`     | The `buildkit` bin (`createCli`), `runBuildkit(argv, overrides)` and `buildkitOptions()` for embedding, the smoke script | `tsc`, like the scaffolder. `npx @buildkitgg/cli init …` runs the bin |

- `defineSettings({ product: "buildkit" })`: `buildkit.jsonc`, `.buildkit/`, secrets in `.env`. Seeds regenerate their
  base from the recorded catalog version, which `buildkit catalog fetch` installs from npm.
- The catalog's version is its package.json version, read at load, so a fetched version always matches the lock.
- **The CLI and the catalog release together** (the `buildkit-cli` Beachball group). New apps pin `@buildkitgg/cli` at
  the catalog's version, and the CLI depends on the catalog exactly, so `pnpm buildkit` runs the catalog that made the
  app.

## The target

`tanstack-start`, family `tanstack-start`, with two modes:

| Mode  | Render model | Facets                                                                                            |
| ----- | ------------ | ------------------------------------------------------------------------------------------------- |
| `ssr` | `ssr-loader` | `react`, `vite`, `ssr`, `request-middleware`, `root-loader`, `router-rewrite`, `server-functions` |
| `spa` | `spa`        | `react`, `vite`, `spa`, `router-rewrite`, `server-functions`                                      |

- `src/start.ts` lists `createCsrfMiddleware({ filter: ({ handlerType }) => handlerType === "serverFn" })` first, then
  the request middleware point. Both modes write it: an SPA's server functions and API routes still need the check.
- `vite.config.ts` spreads `vitePlugins.pre`, then `vitePlugins.framework`, then `tanstackStart()` and
  `react({ compiler: true })`, then `vitePlugins.post`. SPA mode sets `spa.prerender.outputPath: "/index.html"`.
- No cloud: no Wrangler config, no bindings, and no cloud names in app code or `buildkit.jsonc`. A test checks every
  generated file.

| Point                      | Kind   | Generated file | Wired into                       | Contributed by            |
| -------------------------- | ------ | -------------- | -------------------------------- | ------------------------- |
| `vite.plugins`             | list   | `config.ts`    | `vite.config.ts`                 | i18n (`pre`)              |
| `server.requestMiddleware` | chain  | `server.ts`    | `src/start.ts`, after CSRF       | i18n on `ssr`             |
| `app.providers`            | nest   | `client.ts`    | `src/app/providers.tsx`          | nothing yet               |
| `app.bootstrap`            | list   | `client.ts`    | `src/client.tsx`, before hydrate | i18n on `spa`             |
| `router.wrappers`          | wrap   | `client.ts`    | `getRouter()`                    | i18n                      |
| `router.rewrite`           | single | `client.ts`    | `createRouter({ rewrite })`      | i18n with `localizedUrls` |
| `html.attributes`          | single | `client.ts`    | the root shell's `<html>`        | i18n                      |

Generated files are under `src/generated/buildkit/`. Every point is rendered at `init`, so `add` changes only generated
files, `package.json`, `tsconfig.json` and new files.

**Base files:** `package.json` and `tsconfig.json` (shared, by key); `.gitignore` and `.gitattributes` (lines);
`.oxlintrc.json`, `.oxfmtrc.json`, `vite.config.ts`, `src/start.ts`, `src/router.tsx`, `src/client.tsx`,
`src/routes/__root.tsx`, `src/app/providers.tsx`, `src/app/site.ts`, `src/components/route-states.tsx` and
`src/styles.css` (seed); `src/routes/index.tsx`, `README.md` and `AGENTS.md` (sample). `src/routeTree.gen.ts` is the
router's own: `pnpm build` or `pnpm dev` writes it, and the plan lists that command.

## The template, questions and add-ons

One template, `app`. Ids drop cloud names, since they're written into `buildkit.jsonc`.

| Question         | Answers          | Default   |
| ---------------- | ---------------- | --------- |
| Mode             | `ssr`, `spa`     | asked     |
| Optional add-ons | `@buildkit/i18n` | unchecked |
| Always included  | `@buildkit/ci`   |           |

**`@buildkit/ci`** writes `.github/workflows/ci.yml` as keyed YAML: one `verify` job whose steps are keyed by `id`
(checkout, pnpm, Node 24, install, `buildkit check`, lint, format check, build, type-check). Add-ons append their own.

**`@buildkit/i18n`** writes Lingui into the app as code you own (research §4.7), starting from Lingui's TanStack Start
example. Options: `sourceLocale`, `locales` (asked), `detection` (`url`, `cookie`, `header`, in order) and
`localizedUrls`. Locale tags are limited to letters, digits and hyphens, because they become file names.

| File                      | Class  | SSR | SPA | What it does                                                                                                              |
| ------------------------- | ------ | --- | --- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/i18n/locales.ts`     | seed   | yes | yes | The options as constants. `lingui.config.ts` imports them, so one file holds the locale list                              |
| `lingui.config.ts`        | seed   | yes | yes | Catalogs in `src/locales/{locale}.po`                                                                                     |
| `src/i18n/match.ts`       | seed   | yes | yes | Matching tags, the URL prefix, the cookie, `Accept-Language`, and `<html lang dir>` with right-to-left                    |
| `src/i18n/instance.ts`    | seed   | yes | yes | `loadMessages()` imports a `.po` file as a module; `createI18n()` makes a new instance each call                          |
| `src/i18n/provider.tsx`   | seed   | yes | yes | `LocaleProvider`, and the `useLocaleAttributes` hook behind `html.attributes`                                             |
| `src/i18n/server.ts`      | seed   | yes | no  | `localeMiddleware`: detects, makes the request's instance, passes `{ locale, i18n }`, and sets `Vary`                     |
| `src/i18n/router.tsx`     | seed   | yes | yes | `withI18n`: on SSR, the request's instance from `getGlobalStartContext()`, dehydrated and hydrated; on SPA, the browser's |
| `src/i18n/browser.ts`     | seed   | no  | yes | `bootstrapLocale`: detects in the browser and loads messages before hydrating, then sets `<html lang dir>`                |
| `src/i18n/rewrite.ts`     | seed   | yes | yes | `localeRewrite`: `/fr/about` reaches `/about`, and links get the page's prefix. Only with `localizedUrls`                 |
| `src/locales/<locale>.po` | sample | yes | yes | Empty catalogs                                                                                                            |

Scripts `i18n:extract` (`lingui extract --clean`) and `i18n:check` (`lingui check sync && lingui check missing`), and a
"Check translations" CI step when CI is installed. On `ssr`, a visitor whose cookie or language asks for French at `/`
is redirected to `/fr`, because the rewrite gives the page its canonical address.

## What the generated app depends on

All pinned exactly, each on npm for at least a day on 2026-10-29: `react` and `react-dom` 19.3.1,
`@tanstack/react-router` 1.170.46, `@tanstack/react-start` 1.169.4, `vite` 8.3.5, `@vitejs/plugin-react` 6.1.2,
`oxc-transform-react` 0.155.0, `typescript` 7.0.2, `@types/react` and `@types/react-dom` 19.3.0, `@types/node` 24.19.2,
`oxlint` 1.89.0, `oxfmt` 0.74.0. The i18n add-on adds `@lingui/core`, `@lingui/react`, `@lingui/cli` and
`@lingui/vite-plugin` 6.10.1.

## Tests

- **Catalog** (`src/catalog.test.ts`, the pure planner on in-memory trees): `checkCatalog` with the matrix; the
  questionnaire's order; the target's CSRF order, plugin bands and SPA output path; points wired at `init`; no cloud in
  any generated file; the CLI pin; the CI steps and formatter ignores; each add-on's files, entries, env vars and
  notices; i18n on both modes, without localized URLs, and with an unsafe tag; adding i18n without changing a seed; and
  an upgrade that three-way merges a template fix into an edited `src/router.tsx` from the recorded catalog version.
- **CLI** (`src/cli.integration.test.ts`, `runBuildkit` against a temp folder): `init`, then `check`, `sync` and
  `explain`; `catalog --json`; `add i18n` keeping an edited seed and your `package.json` keys; `upgrade --list` and
  `upgrade` from a catalog version built in the test; and an edited seed that a two-way upgrade leaves alone as a
  conflict. CI runs these on Linux, Windows and macOS.
- **Smoke** (`pnpm --filter @buildkitgg/cli test:smoke`, a `templates` CI job): `ssr`, `spa`, `ssr` with i18n, and `spa`
  with `add i18n`. Each installs with the Buildkit packages packed from the checkout, then runs `buildkit check`, lint,
  format check, build, type-check and, with i18n, `i18n:check`. The SSR cases also request `/`, a missing page, `/fr`
  and a French visitor at `/` from the built server.

## Engine follow-ups

The phase found seven gaps in the engine. All but one are fixed.

1. **`init <folder>` ignored `--cwd`.** Fixed in #68: the folder resolves against `--cwd`.
2. **`CliOptions` couldn't take earlier catalog versions.** Fixed in #68: `catalogs` gives `runCli` an upgrade's
   three-way baseline.
3. **Keyed appends couldn't be ordered.** A keyed `json` or `yaml` append takes `order: { after, before }`, naming the
   keys of other items, so an add-on's CI step goes where it belongs: the translations check runs after `format`, before
   the build. The order places an item when it's added and never moves one you have. A `ci.steps` point isn't needed:
   keyed steps keep your own steps and your edits, which a generated file can't.
4. **The engine's JSON layout wasn't the formatter's.** The engine now lays out what it writes as oxfmt and Prettier do,
   for the width in the product's settings (`printWidth`, 120 for Buildkit): short lists go on one line, an object keeps
   how it's written, and `package.json` is laid out as `JSON.stringify` writes it, which is the formatters' layout for
   it. `buildkit.jsonc`, `package.json` and `tsconfig.json` are no longer left out of oxfmt, and the CLI's smoke test
   checks the generated apps with it.
5. **Point files imported app modules with their extension.** Add-ons now name modules without one
   (`./src/i18n/router`), so generated files import `../../i18n/router`. Apps no longer set
   `allowImportingTsExtensions`, and the starter config files import without extensions too. This was a catalog fix: the
   engine prints the module an entry names.
6. **Points are per target, not per mode.** Not changed, because TanStack Start runs both points in both modes. An SPA
   still has server functions and server routes, which request middleware runs for, and an SSR app's browser runs
   `app.bootstrap` before it hydrates. Points per mode wait for a target with a point only one of its modes can run.
7. **No `match()` helper.** `match(value, cases)` runs the case for a value. A missing case is a type error when the
   value is a union, and a plan error otherwise. Catalog CI's matrix finds that in each mode for the add-ons its answer
   sets select; an add-on no template offers needs its own test. The localization add-on uses it instead of a `switch`
   that throws.

## Decisions made in this phase

- **Templates are real files** in `templates/<set>/<path>`, read with `node:fs` at plan time. The catalog runs only in
  Node; the engine's rule against `node:*` covers the engine. The repo's formatter formats them, and the generated app's
  formatter uses the same settings, so a new app passes `pnpm format:check`.
- **Server-only modules are `*.server.ts`,** which Start's import protection keeps out of the browser bundle.
- **No `db.schema` point.** drizzle-kit reads `src/db/*schema.ts`, so an add-on adds its tables as a file there. Better
  Auth gets its tables from its own schema file.
- **`router.wrappers` extend the router in place** (`(router: AnyRouter) => void`), the way Lingui's and TanStack
  Query's router helpers do. **`html.attributes` holds a hook,** so it can read the active locale.
- **Lingui's own checks replace `scripts/i18n.ts`:** Lingui 6 ships `lingui check sync` and `lingui check missing`.
  `translate` is deferred: it needs an AI provider.
- **Detection is `url`, `cookie`, `header` in both modes.** The browser reads `document.cookie` and
  `navigator.languages`, so an SPA ignores none of them.
- **No `$schema` in `buildkit.jsonc`** until a schema is hosted; `buildkit schema` prints it.

## Libraries

The Buildkit packages use only `@buildkitgg/scaffolder`, `zod` and `citty`, all in [the tech stack](../tech-stack.md).
The generated apps use TanStack Start and Router, React, Vite, Drizzle, Better Auth, oxlint and oxfmt, all in the stack,
and `@vitejs/plugin-react` with `oxc-transform-react`, which the repo's apps already use. Lingui, which D4 chose, is in
the stack for generated apps since the owner approved it on 2026-10-29; Buildkit's own packages keep FormatJS.

## Publishing

Both packages need a first manual npm publish, then `npm trust github` for the `publish.yml` workflow, as the scaffolder
did ([releases.md](../releases.md)).
