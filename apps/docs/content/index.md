# Buildkit documentation

Typed packages for the patterns every app rebuilds: preferences, themes, modals, alerts, routing and configuration, plus
the tools to develop apps with them.

## Choose the layer you need

- Core packages hold each pattern's state, operations and lifecycle in plain TypeScript, with no framework dependency.
- React packages connect that behavior to your components through hooks and subscriptions.
- Adapters for your component library render that behavior with its components. Buildkit ships adapters for shadcn and
  Fluent UI.
- Developer tools give local servers stable URLs, create and upgrade apps, mock APIs, and share lint and Storybook
  configuration.

Start with an adapter when one matches your app. When you want to own the integration, use a core directly or write your
own adapter on it.

## Find your next step

[Package guides](/packages/) cover installation and practical usage, rendered from each package’s README. For shadcn
components, the [shadcn-sync guide](/packages/shadcn-sync/) shows how to build them into a package inside your app.

[Routing](/routing/) groups route tabs and panels, with integrations for React Router and TanStack Router alongside
their shared core and React bindings.

Find exported types, function signatures, and available subpath imports in the [API reference](/reference/). Interactive
examples live in Storybook, under **Examples** in the navigation bar.

## Public API changes

API reports are checked into the repository and verified in CI. An intentional signature change needs a reviewed
baseline update. The report identifies signature differences; release compatibility and behavior still require review.
