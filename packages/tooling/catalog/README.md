# @buildkitgg/catalog

Buildkit's scaffolding catalog for [`@buildkitgg/scaffolder`](../scaffolder/README.md): the TanStack Start target, the
`app` template, and the add-ons `buildkit create` and `buildkit add` offer. You run it through the
[`buildkit` CLI](../cli/README.md); import it directly only to plan Buildkit apps in your own tools.

Requires Node.js 24 or later. Until 1.0, minor versions may change what the catalog generates.

```ts
import { catalog, settings } from "@buildkitgg/catalog"
import { memoryTree, plan } from "@buildkitgg/scaffolder"

const planned = await plan({
  catalog,
  settings,
  tree: memoryTree({}),
  request: { intent: { command: "init", answers: { template: "app", mode: "ssr", name: "my-app" } } }
})
```

`settings` names Buildkit's state files: `buildkit.jsonc` for your choices, `.buildkit/` for the lock, and `.env` for
secrets the wizard asks for.

## The target

`tanstack-start` is a React app on TanStack Start with two modes: `ssr` (server-rendered) and `spa` (one prerendered
shell at `/index.html`). It names no cloud: the app has no Wrangler config, no bindings and no cloud names in its code
or `buildkit.jsonc`. Its starter files import the generated glue in `src/generated/buildkit/` once, at `create`, so
adding an add-on only changes generated files.

| Point                      | Kind   | Generated file | Used by                                                                         |
| -------------------------- | ------ | -------------- | ------------------------------------------------------------------------------- |
| `vite.plugins`             | list   | `config.ts`    | `vite.config.ts`: `pre`, then `framework` before `tanstackStart()`, then `post` |
| `server.requestMiddleware` | chain  | `server.ts`    | `src/start.ts`, after Start's CSRF check for server functions                   |
| `app.providers`            | nest   | `client.ts`    | `src/app/providers.tsx`, around every page in the root shell                    |
| `app.bootstrap`            | list   | `client.ts`    | `src/client.tsx`, before the browser hydrates                                   |
| `router.wrappers`          | wrap   | `client.ts`    | `getRouter()` in `src/router.tsx`                                               |
| `router.rewrite`           | single | `client.ts`    | The router's `rewrite` option                                                   |
| `html.attributes`          | single | `client.ts`    | A hook the root shell calls for `<html lang dir>`                               |

Every app also gets lint, format, build and type-check scripts, a `.gitattributes` that marks generated files, and the
`@buildkitgg/cli` dev dependency at the catalog's version, so `pnpm buildkit upgrade` runs in the project.

## The `app` template

The wizard asks for the mode (`ssr` or `spa`), then "Add localization?", which defaults to no. `ci` is always included,
and `--i18n i18n` or `--no-i18n` answers the question from the command line. `catalog --json` describes the template
with its gallery tags (`react`, `tanstack-start`, `ssr`, `spa`) and links to this README and its source.

Once the app is applied, `buildkit create` offers the setup steps: `pnpm install`, then `pnpm build`, which writes
`src/routeTree.gen.ts` for the type check, then a git repository with a first commit. Apps pin pnpm in `packageManager`,
so setup installs with pnpm whichever package manager ran the CLI. `--setup` runs them without asking, and `--no-setup`
lists them in the next steps instead.

| Add-on           | What it writes                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@buildkit/ci`   | `.github/workflows/ci.yml`: `buildkit check`, lint, format, build and type-check on every push and pull request. Steps are keyed by `id`, so add-ons add their own                                        |
| `@buildkit/i18n` | Lingui 6 as app code in `src/i18n/`: request middleware on `ssr`, browser detection on `spa`, a router wrapper, localized URLs through the router's rewrite, `<html lang dir>`, catalogs in `src/locales` |
