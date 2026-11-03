# Engineering docs

- [Conventions](conventions.md)
- [TypeScript](typescript.md)
- [React](react.md)
- [Hooks](hooks.md)
- [Recommended stack](platform-planning/stack.md)
- [Build plans: packages, services and pipelines we will build](platform-planning/build-plans.md)
- [Preferred tools](tech-stack.md)
- [Package lifecycle](packages.md)
- [Releases](releases.md)
- [Website and documentation deployment](website.md)
- [Reference site development](../apps/docs/README.md)
- [Public API baselines and extraction](../api-reports/README.md)
- [Public behavior APIs](public-apis.md)
- [Inline alerts and native toast architecture](alerts.md)
- [Modal architecture and lifecycle](modals.md)
- [Typed modal forms and inferred state](modal-forms.md)
- [Updating modal content, state and presentation](modal-updates.md)
- [Shared behavior packages and Fluent extraction plan](behavior-packages.md)

Theme packages: [core](../packages/core/theme-core/README.md), [React](../packages/react/react-theme/README.md),
[shadcn](../packages/shadcn/shadcn-theme/README.md), [Fluent UI](../packages/fluentui/fluentui-theme/README.md).

The unified package documentation and component workshop lives in `apps/behavior-storybook`
(`pnpm --filter @buildkitgg/behavior-storybook storybook`).

Preferences packages: [core](../packages/core/preferences-core/README.md),
[React](../packages/react/react-preferences/README.md).

[TypeScript utilities](../packages/core/typescript-utils/README.md): es-toolkit, ts-extras, ts-pattern, type-fest and
tiny-invariant behind one import, with ts-reset. Shared configs: [Oxlint](../packages/tooling/oxlint-config/README.md),
including the anti-slop rule set and its [vendored plugin](../packages/tooling/oxlint-config/docs/anti-slop.md), and
[Storybook](../packages/tooling/storybook-config/README.md).

Package-specific docs live in each package’s `docs/README.md`. Start with
[dev-domains](../packages/tooling/dev-domains/docs/README.md).

[API Mocker](../packages/tooling/api-mocker/README.md) registers MSW endpoints for Storybook and tests.

[Scaffolder](../packages/tooling/scaffolder/README.md): the plan-first scaffolding engine behind product CLIs, with its
[architecture guide](../packages/tooling/scaffolder/docs/README.md). Buildkit's own
[catalog](../packages/tooling/catalog/README.md) and [`buildkit` CLI](../packages/tooling/cli/README.md) run on it.
[Template packages](platform-planning/scaffolder-template-packages.md): templates anyone can publish to npm for a
product's catalog, installed by name. [Templates for platforms](platform-planning/scaffolder-platform-templates.md): the
planned move to questions, bare add-ons, version ranges and combination add-ons, so a platform can ship many starters.

[shadcn component styles](shadcn/README.md) documents installation, styling, and maintenance of the generated Base UI
packages.

[Route tabs and panels](routing.md): shared behavior and React Router / TanStack Router integrations.

Configuration: [core and provider contract](../packages/core/configuration-core/README.md),
[React subscriptions](../packages/react/react-configuration/README.md).

[Generated shadcn styles and dependency aliases](shadcn/styles.md).

[Shadcn localization, RTL, and class merging](shadcn/localization.md).

[Better Apps](https://github.com/betterapps-hq/better-apps), the app features the scaffolder's add-ons use, lives in its
own repository.
