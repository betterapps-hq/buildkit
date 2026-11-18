# oxlint-plugin-anti-slop

Published as `@buildkitgg/oxlint-plugin-anti-slop`. `src/vendor/anti-slop` is a pinned copy of upstream that only
`pnpm sync:anti-slop` writes; see [vendored anti-slop](vendoring.md). `src/recommended.ts` is the recommended rule set
the package exports. `@buildkitgg/oxlint-config`'s base registers the plugin itself and turns on all of its rules. Run
root `pnpm verify` after changes.
