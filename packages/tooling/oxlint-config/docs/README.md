# oxlint-config

Published as `@buildkitgg/oxlint-config`. The root `vite.config.ts` extends `src/base.ts`, so add a rule there to apply
it across the repository. The anti-slop rule set is a separate export that apps opt into. See
[vendored anti-slop](anti-slop.md) for how its plugin is copied and updated. Run root `pnpm verify` after changes.
