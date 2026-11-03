# @buildkitgg/oxlint-config

Shared [Oxlint](https://oxc.rs/docs/guide/usage/linter) configuration: Buildkit's base rules, and the anti-slop rule
set, which rejects patterns that make TypeScript harder to trust, such as unchecked type assertions, `unknown` passed
around instead of decoded, and conditional empty spreads.

```sh
pnpm add -D @buildkitgg/oxlint-config
```

Oxlint 1.89 or later is required. Vite+ 1.4 includes it.

## Anti-slop rule set

With [Vite+](https://viteplus.dev), extend `@buildkitgg/oxlint-config/anti-slop` from the `lint` block of
`vite.config.ts`:

```ts
import antiSlop from "@buildkitgg/oxlint-config/anti-slop"
import { defineConfig } from "vite-plus"

export default defineConfig({
  lint: { extends: [antiSlop] }
})
```

With Oxlint on its own, extend it from `oxlint.config.ts`:

```ts
import antiSlop from "@buildkitgg/oxlint-config/anti-slop"
import { defineConfig } from "oxlint"

export default defineConfig({
  extends: [antiSlop]
})
```

The rule set registers the anti-slop plugin and turns on every rule below as an error. Nothing else needs to be
installed. It needs a TypeScript config rather than `.oxlintrc.json`, because `.oxlintrc.json` can only extend files by
path and the plugin is located at runtime.

To change a rule, set it after `extends`. Later settings win:

```ts
export default defineConfig({
  extends: [antiSlop],
  rules: {
    "anti-slop/require-readable-spacing": "off",
    "anti-slop/no-runtime-typeof": ["error", { allowInTypeGuards: true }]
  },
  overrides: [{ files: ["**/*.test.ts"], rules: { "anti-slop/no-module-mocking": "off" } }]
})
```

| Rule                                                  | What it reports                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `anti-slop/no-array-filter-map`                       | A `filter` followed by a `map`. Use one transformation or lazy iterator helpers                                                      |
| `anti-slop/no-reduce-accumulator-copy`                | Reducers that copy their growing accumulator with `Object.assign`, `Array.from` or array copy methods                                |
| `anti-slop/no-chained-type-assertions`                | Chained `as` or angle-bracket assertions, such as `value as unknown as User`                                                         |
| `anti-slop/no-conditional-empty-object-spread`        | `...(condition ? { field } : {})` and similar spreads used to leave fields out                                                       |
| `anti-slop/no-known-value-widening`                   | Known values passed into broad or anonymous types that throw away what was known about them                                          |
| `anti-slop/no-module-mocking`                         | `vi.mock` and `jest.mock`. Replace dependencies through real interfaces instead                                                      |
| `anti-slop/no-object-parameters`                      | Parameters typed with the broad `object` type. Accept a named type, and parse external input at its boundary                         |
| `anti-slop/no-reflect-apply`                          | `Reflect.apply`. Call typed functions directly                                                                                       |
| `anti-slop/no-reflect-get`                            | `Reflect.get`. Use typed property access, or parse dynamic input into a domain type                                                  |
| `anti-slop/no-runtime-typeof`                         | Runtime `typeof` checks. Decode external values at their I/O boundary. `allowInTypeGuards` permits them inside type guards           |
| `anti-slop/no-unsafe-dictionary-type`                 | Dictionary types whose values are `unknown`, `any`, `object` or `{}`                                                                 |
| `anti-slop/no-shape-in-symbol-names`                  | Names containing "shape"                                                                                                             |
| `anti-slop/no-unknown-parameters`                     | Parameters typed `unknown`, other than `cause` and type guard subjects                                                               |
| `anti-slop/no-unknown-returns`                        | Functions declared to return `unknown` or `Promise<unknown>`                                                                         |
| `anti-slop/no-unknown-type-aliases`                   | Type aliases that resolve to `unknown`                                                                                               |
| `anti-slop/no-widen-then-assert`                      | A known value widened to a broader type and then asserted back to a narrower one                                                     |
| `anti-slop/require-readable-spacing`                  | Missing blank lines between declarations and groups of statements. Fixable with `oxlint --fix`                                       |
| `anti-slop/require-safety-comment-for-type-assertion` | Type assertions without a nearby `SAFETY:` comment explaining why they hold. `as const` is exempt. `markers` changes the comment tag |
| `oxc/no-accumulating-spread`                          | Spreading an accumulator inside `reduce` or a loop, which copies it on every pass                                                    |

The rules come from [anti-slop](https://github.com/dmmulroy/anti-slop) by Dillon Mulroy (MIT), vendored at a pinned
commit. Its Effect rules aren't included. See [vendored anti-slop](../../../docs/anti-slop.md) for how it is updated.

Oxlint JS plugins are in alpha and outside semver, so a new Oxlint release may need a matching release of this package.

## Base rules

`@buildkitgg/oxlint-config/base` holds the rules every Buildkit package lints with: the correctness category, strict
TypeScript rules, and the React, Vitest, import and accessibility plugins. Extend it the same way:

```ts
import antiSlop from "@buildkitgg/oxlint-config/anti-slop"
import base from "@buildkitgg/oxlint-config/base"
import { defineConfig } from "vite-plus"

export default defineConfig({
  lint: { extends: [base, antiSlop] }
})
```

The base rules don't include the anti-slop rule set.
