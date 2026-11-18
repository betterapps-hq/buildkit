# Engineering docs

## Conventions

- [Conventions](conventions.md), with [TypeScript](typescript.md), [React](react.md) and [hooks](hooks.md)
- [Preferred tools](tech-stack.md) and the [recommended stack](platform-planning/stack.md)
- [Shared Playbook guidance](playbook.md): syncing rules, best practices and skills

## Behavior packages

- [Shared application behavior](behavior-packages.md), including the plan for extracting existing Fluent UI code
- [Public behavior APIs](public-apis.md)
- [Modal architecture and lifecycle](modals.md), [typed modal forms](modal-forms.md) and
  [modal slots and updates](modal-updates.md)
- [Inline alerts and native toasts](alerts.md)
- [Route tabs and panels](routing.md): the shared behavior and the React Router and TanStack Router integrations

Package READMEs: preferences ([core](../packages/core/preferences-core/README.md),
[React](../packages/react/react-preferences/README.md)), themes ([core](../packages/core/theme-core/README.md),
[React](../packages/react/react-theme/README.md), [shadcn](../packages/shadcn/shadcn-theme/README.md),
[Fluent UI](../packages/fluentui/fluentui-theme/README.md)) and configuration
([core and provider contract](../packages/core/configuration-core/README.md),
[React subscriptions](../packages/react/react-configuration/README.md)).

## shadcn components

[shadcn components](shadcn/README.md): the [`shadcn-sync`](../packages/shadcn/shadcn-sync/README.md) command builds a
configurable `@buildkitgg/shadcn` package inside an app. Guides: [choosing components](shadcn/styles.md),
[theming](shadcn/theming.md), [text direction and labels](shadcn/localization.md) and
[framework integration](shadcn/integration.md). See also the [example app](../apps/shadcn-sync-example/README.md), the
[Fluent icon adapter](../packages/shadcn/shadcn-icons-fluent/README.md) and the
[plan behind shadcn-sync](platform-planning/shadcn-sync.md).

## Tools and configuration

- [TypeScript utilities](../packages/core/typescript-utils/README.md): es-toolkit, ts-extras, ts-pattern, type-fest and
  tiny-invariant behind one import, with ts-reset.
- Shared configs: [Oxlint](../packages/tooling/oxlint-config/README.md), with the
  [anti-slop plugin](../packages/tooling/oxlint-plugin-anti-slop/README.md) as its own package, and
  [Storybook](../packages/tooling/storybook-config/README.md).
- [API Mocker](../packages/tooling/api-mocker/README.md) registers MSW endpoints for Storybook and tests.
- [dev-domains](../packages/tooling/dev-domains/docs/README.md): stable local URLs for each server and worktree.
- [Scaffolder](../packages/tooling/scaffolder/README.md): the plan-first scaffolding engine behind product CLIs, with
  its [architecture guide](../packages/tooling/scaffolder/docs/README.md). Buildkit's own
  [catalog](../packages/tooling/catalog/README.md) and [`buildkit` CLI](../packages/tooling/cli/README.md) run on it.
  [Template packages](platform-planning/scaffolder-template-packages.md) are templates anyone can publish to npm for a
  product's catalog, installed by name. [Templates for platforms](platform-planning/scaffolder-platform-templates.md)
  covers the questions, bare add-ons, version ranges and combination add-ons that let a platform ship many starters.

Many packages keep longer documentation in their own `docs/README.md`.

## Releases, docs and the website

- [Package lifecycle](packages.md)
- [Releases](releases.md)
- [Public API baselines and extraction](../api-reports/README.md)
- [Website and documentation deployment](website.md)
- [Reference site development](../apps/docs/README.md)
- [Storybook](../apps/behavior-storybook/README.md): package guides and interactive examples, run with
  `pnpm --filter @buildkitgg/behavior-storybook storybook`

## Plans

- [Build plans](platform-planning/build-plans.md): packages, services and pipelines we plan to build

[Better Apps](https://github.com/betterapps-hq/better-apps), app features with their own tables, actions and events,
such as comments and mentions, lives in its own repository.
