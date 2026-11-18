# Buildkit Storybook

Package guides and interactive examples for every Buildkit pattern, in one Storybook. Build the libraries with
`pnpm build:packages`, run `pnpm --filter @buildkitgg/behavior-storybook storybook`, then open http://127.0.0.1:6009/.

## What's inside

Getting started introduces the package directory and the architecture. Core and React hold the shared behavior and its
bindings, including the preferences and configuration examples. The shadcn and Fluent UI sections group each component
library's adapters with their guides and examples. Routing groups the shared core, React bindings, React Router and
TanStack Router. Tooling covers the `buildkit` CLI, the scaffolder, and dev-domains setup, worktree URLs and Playwright
configuration.

Examples that need shadcn components import `@buildkitgg/shadcn`, which shadcn-sync builds for this app from its
`postinstall`: Base UI primitives, the `nova` style, the `neutral` theme and Lucide icons.

Modal stories live in `src/modals`. The core story shows lifecycle transitions, and the React story renders a custom
native-dialog adapter. The shadcn modals manager, including its Radix adapter, and the Fluent UI modals manager share
one set of scenarios from `ModalExamples.tsx`, from a simple confirmation to a typed form with a failed save, retry and
guarded cancellation. None of them needs a form library.

## Writing guides and examples

Package guides live in `src/documentation`. Examples live beside the stories: alerts in `src/alerts`, modals in
`src/modals`, routing in `src/routing`, and the other demos at the top of `src`. Focus on stable package purposes, APIs
and integration guidance. Keep versions, publication status and component counts out of the documentation; the package
registry and release history hold release information. Keep examples focused and their persistent demo keys separate,
and document resets and lifecycle ownership.
