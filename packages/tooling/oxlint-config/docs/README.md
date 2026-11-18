# oxlint-config

Published as `@buildkitgg/oxlint-config`. The root `vite.config.ts` extends `src/base.ts`, so a rule added there applies
across the repository. Base registers
[`@buildkitgg/oxlint-plugin-anti-slop`](../../oxlint-plugin-anti-slop/docs/README.md) and turns on every one of its
rules as an error, not only its recommended set. Run root `pnpm verify` after changes.
