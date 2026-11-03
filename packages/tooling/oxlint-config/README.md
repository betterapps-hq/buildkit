# @buildkitgg/oxlint-config

Shared [Oxlint](https://oxc.rs/docs/guide/usage/linter) configuration: the rules every Buildkit package lints with,
including [`@buildkitgg/oxlint-plugin-anti-slop`](../oxlint-plugin-anti-slop/README.md).

```sh
pnpm add -D @buildkitgg/oxlint-config
```

Oxlint 1.89 or later is required. Vite+ 1.4 includes it.

## Base rules

`@buildkitgg/oxlint-config/base` holds the rules every Buildkit package lints with: the correctness category, strict
TypeScript rules, the React, Vitest, import and accessibility plugins, and every anti-slop rule. With
[Vite+](https://viteplus.dev), extend it from the `lint` block of `vite.config.ts`:

```ts
import base from "@buildkitgg/oxlint-config/base"
import { defineConfig } from "vite-plus"

export default defineConfig({
  lint: { extends: [base] }
})
```

With Oxlint on its own, extend it from `oxlint.config.ts` with `defineConfig` from `oxlint`.

## Anti-slop rules

The base rules register the anti-slop plugin, installed with this package, and turn on every one of its rules. Its
[README](../oxlint-plugin-anti-slop/README.md) lists the rules. To change one, set it after `extends`:

```ts
export default defineConfig({
  lint: {
    extends: [base],
    rules: { "anti-slop/no-runtime-typeof": ["error", { allowInTypeGuards: true }] }
  }
})
```

A `jsPlugins` list in your own config replaces the plugins base registers, so include them when you add one:

```ts
lint: {
  extends: [base],
  jsPlugins: [...(base.jsPlugins ?? []), { name: "my-plugin", specifier: "my-oxlint-plugin" }]
}
```

To use the anti-slop rules without the base rules, install the plugin on its own.
