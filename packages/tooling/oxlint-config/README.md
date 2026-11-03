# @buildkitgg/oxlint-config

Shared [Oxlint](https://oxc.rs/docs/guide/usage/linter) configuration: Buildkit's base rules, and the anti-slop rule set
from [`@buildkitgg/oxlint-plugin-anti-slop`](../oxlint-plugin-anti-slop/README.md).

```sh
pnpm add -D @buildkitgg/oxlint-config
```

Oxlint 1.89 or later is required. Vite+ 1.4 includes it.

## Base rules

`@buildkitgg/oxlint-config/base` holds the rules every Buildkit package lints with: the correctness category, strict
TypeScript rules, and the React, Vitest, import and accessibility plugins. With [Vite+](https://viteplus.dev), extend it
from the `lint` block of `vite.config.ts`:

```ts
import base from "@buildkitgg/oxlint-config/base"
import { defineConfig } from "vite-plus"

export default defineConfig({
  lint: { extends: [base] }
})
```

With Oxlint on its own, extend it from `oxlint.config.ts` with `defineConfig` from `oxlint`.

## Anti-slop rule set

`@buildkitgg/oxlint-config/anti-slop` is the plugin's recommended rule set, installed with this package. The base rules
don't include it, so add it next to them:

```ts
import antiSlop from "@buildkitgg/oxlint-config/anti-slop"
import base from "@buildkitgg/oxlint-config/base"
import { defineConfig } from "vite-plus"

export default defineConfig({
  lint: { extends: [base, antiSlop] }
})
```

To use the anti-slop rules without the base rules, install
[`@buildkitgg/oxlint-plugin-anti-slop`](../oxlint-plugin-anti-slop/README.md) on its own. Its README lists the rules and
how to change them.
