# @buildkitgg/oxlint-plugin-anti-slop

[anti-slop](https://github.com/dmmulroy/anti-slop) by Dillon Mulroy, published to npm. Upstream is meant to be copied
into each project and has no npm package, so this package is that copy at a pinned commit, without its Effect rules.

anti-slop is an [Oxlint](https://oxc.rs/docs/guide/usage/linter) plugin that rejects patterns that make TypeScript
harder to trust, such as unchecked type assertions, `unknown` passed around instead of decoded, and conditional empty
spreads. It works on its own, without Buildkit's other lint rules.

```sh
pnpm add -D @buildkitgg/oxlint-plugin-anti-slop
```

Oxlint 1.89 or later is required. Vite+ 1.4 includes it.

## Recommended rule set

`@buildkitgg/oxlint-plugin-anti-slop/recommended` registers the plugin and turns on every rule below as an error. With
[Vite+](https://viteplus.dev), extend it from the `lint` block of `vite.config.ts`:

```ts
import antiSlop from "@buildkitgg/oxlint-plugin-anti-slop/recommended"
import { defineConfig } from "vite-plus"

export default defineConfig({
  lint: { extends: [antiSlop] }
})
```

With Oxlint on its own, extend it from `oxlint.config.ts`:

```ts
import antiSlop from "@buildkitgg/oxlint-plugin-anti-slop/recommended"
import { defineConfig } from "oxlint"

export default defineConfig({
  extends: [antiSlop]
})
```

The rule set needs a TypeScript config rather than `.oxlintrc.json`, because `.oxlintrc.json` can only extend files by
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

## Choosing rules yourself

Register the plugin by package name under `jsPlugins` and turn on only the rules you want. This works from
`.oxlintrc.json` too:

```json
{
  "jsPlugins": [{ "name": "anti-slop", "specifier": "@buildkitgg/oxlint-plugin-anti-slop" }],
  "rules": {
    "anti-slop/no-array-filter-map": "error",
    "anti-slop/no-chained-type-assertions": "error"
  }
}
```

## Rules

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

`oxc/no-accumulating-spread` is a built-in Oxlint rule that the recommended rule set turns on alongside the plugin's.

Upstream is MIT licensed, and its license ships with this package. See [vendored anti-slop](docs/vendoring.md) for how
the copy is updated.

Oxlint JS plugins are in alpha and outside semver, so a new Oxlint release may need a matching release of this package.
