# oxlint-plugin-anti-slop

Published as `@buildkitgg/oxlint-plugin-anti-slop`. `src/vendor/anti-slop` is a pinned copy of upstream, written only by
`pnpm sync:anti-slop`; see [vendored anti-slop](vendoring.md). `src/recommended.ts` is the rule set it exports, and
`@buildkitgg/oxlint-config`'s base rules register the plugin itself. Run root `pnpm verify` after changes.
