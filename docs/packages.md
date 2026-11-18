# Package lifecycle

Every package uses the `@buildkitgg/*` scope, published or private, and apps stay private. A published package owns its
README, explicit exports, types, build and tests, and many keep longer documentation in their own `docs/README.md`. Keep
Node and browser entry points separate. React libraries declare React as a peer dependency. The shadcn modals and alerts
managers also peer on `@buildkitgg/shadcn`, the package `@buildkitgg/shadcn-sync` builds inside each app.

Packages stay private during incubation. Before publishing, confirm npm scope ownership, review public APIs and MIT
notices, verify the packed artifact in a separate consumer, and configure release credentials. Remove `private` only
when the package is ready for release. Beachball change files record each package's version changes, and CI publishes
them from main; see [Releases](releases.md).

Run `pnpm verify` before committing. CI runs the same checks on Linux, and the dev-domains, scaffolder and `buildkit`
CLI integration tests on Linux, Windows and macOS. It also generates Buildkit apps and installs, checks, lints, builds
and type-checks each one (`pnpm --filter @buildkitgg/cli test:smoke`). UI changes need acceptance in a browser.
