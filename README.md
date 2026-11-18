# Buildkit

Typed packages for the patterns every app rebuilds: preferences, themes, modals, alerts, routing and configuration. Each
pattern's state and lifecycle live in a plain TypeScript core. React bindings connect that core to your app, and
adapters connect it to your component library, so a modal or an alert keeps the same API whichever components draw it.
When no adapter fits, write your own on the same core.

## Packages

The packages below are published to npm under the `@buildkitgg` scope. Install the layers your app uses: a core on its
own, its React bindings, or a component library adapter, which brings the layers beneath it.

| Pattern                                                                 | Core                                                               | React                                                                                                                                                                                                     | Component library adapters                                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Preferences: typed defaults, overrides, storage, JSON import and export | [`preferences-core`](packages/core/preferences-core/README.md)     | [`react-preferences`](packages/react/react-preferences/README.md)                                                                                                                                         |                                                                                                                                                              |
| Themes: system, light and dark selection                                | [`theme-core`](packages/core/theme-core/README.md)                 | [`react-theme`](packages/react/react-theme/README.md)                                                                                                                                                     | [`shadcn-theme`](packages/shadcn/shadcn-theme/README.md), [`fluentui-theme`](packages/fluentui/fluentui-theme/README.md)                                     |
| Modals: typed results, nested dialogs, guarded dismissal, async forms   | [`modal-core`](packages/core/modal-core/README.md)                 | [`react-modals`](packages/react/react-modals/README.md)                                                                                                                                                   | [`shadcn-modals-manager`](packages/shadcn/shadcn-modals-manager/README.md), [`fluentui-modals-manager`](packages/fluentui/fluentui-modals-manager/README.md) |
| Alerts: persistent inline alerts with handles                           | [`alert-core`](packages/core/alert-core/README.md)                 | [`react-alerts`](packages/react/react-alerts/README.md)                                                                                                                                                   | [`shadcn-alerts-manager`](packages/shadcn/shadcn-alerts-manager/README.md), [`fluentui-alerts-manager`](packages/fluentui/fluentui-alerts-manager/README.md) |
| Routing: tabs and panels that follow the URL                            | [`router-core`](packages/core/router-core/README.md)               | [`react-routing`](packages/react/react-routing/README.md), with [`react-router`](packages/react/react-router/README.md) and [`tanstack-router`](packages/react/tanstack-router/README.md) for your router |                                                                                                                                                              |
| Configuration: typed, provider-agnostic, with developer overrides       | [`configuration-core`](packages/core/configuration-core/README.md) | [`react-configuration`](packages/react/react-configuration/README.md)                                                                                                                                     |                                                                                                                                                              |

The engineering docs explain the design behind [modals](docs/modals.md), [alerts](docs/alerts.md) and
[routing](docs/routing.md).

### shadcn components

[`shadcn-sync`](packages/shadcn/shadcn-sync/README.md) builds stock shadcn components into a `@buildkitgg/shadcn`
package inside your app, for the primitives, icons, style and theme you pick. Run it in the app's folder:

```sh
pnpm dlx @buildkitgg/shadcn-sync
```

Then import components like any other package:

```tsx
import { Button } from "@buildkitgg/shadcn"
```

The shadcn adapters above use the same package as a peer, and
[`shadcn-icons-fluent`](packages/shadcn/shadcn-icons-fluent/README.md) swaps in Fluent UI icons. See
[shadcn components](docs/shadcn/README.md).

### Utilities and tools

- [`typescript-utils`](packages/core/typescript-utils/README.md): es-toolkit, ts-extras, ts-pattern, type-fest and
  tiny-invariant from one import, with ts-reset applied.
- [`dev-domains`](packages/tooling/dev-domains/README.md): stable local URLs for each server and Git worktree, through
  Portless, with typed configuration, guided setup and webhook tunnels.
- [`scaffolder`](packages/tooling/scaffolder/README.md): a plan-first scaffolding engine that creates projects from a
  catalog and upgrades them without overwriting your edits. The [`buildkit` CLI](packages/tooling/cli/README.md) runs it
  on [Buildkit's catalog](packages/tooling/catalog/README.md).
- [`api-mocker`](packages/tooling/api-mocker/README.md): mock HTTP endpoints on MSW for Storybook and tests.
- [`oxlint-config`](packages/tooling/oxlint-config/README.md),
  [`oxlint-plugin-anti-slop`](packages/tooling/oxlint-plugin-anti-slop/README.md) and
  [`storybook-config`](packages/tooling/storybook-config/README.md): shared lint rules and Storybook configuration.
  `typescript-config`, the shared TypeScript configuration, is used inside this repository and isn't published.

## Development

Use Node 24.11+ or 26+ and pnpm 12. Run `pnpm install`, then `pnpm verify`, which checks formatting, lint, types, unused
code, [API reports](api-reports/README.md) and test coverage, then builds everything.

The previews below import the built packages, so run `pnpm build:packages` first.

| To preview                                 | Run                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Storybook: package guides and examples     | `pnpm --filter @buildkitgg/behavior-storybook storybook`                                               |
| The buildkit.gg landing page (`apps/site`) | `pnpm --filter @buildkitgg/site dev`                                                                   |
| The reference docs (`apps/docs`)           | `pnpm check:api`, `pnpm --filter @buildkitgg/docs generate`, then `pnpm --filter @buildkitgg/docs dev` |

Libraries live under `packages/core`, `packages/react`, `packages/shadcn` and `packages/fluentui`, and shared
configuration and developer tools under `packages/tooling`. Package names and imports don't depend on the folder. Apps
and examples live under `apps/`. [Website deployment](docs/website.md) covers how the site, docs and Storybook publish.

See the [engineering docs](docs/README.md), [contributing guide](CONTRIBUTING.md), [agent instructions](AGENTS.md) and
[MIT license](LICENSE).
