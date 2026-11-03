# @buildkitgg/typescript-utils

One dependency for everyday TypeScript utilities. It re-exports [es-toolkit](https://es-toolkit.dev),
[ts-extras](https://github.com/sindresorhus/ts-extras), [ts-pattern](https://github.com/gvergnaud/ts-pattern),
[type-fest](https://github.com/sindresorhus/type-fest) and
[tiny-invariant](https://github.com/alexreardon/tiny-invariant) from a single root import, and applies
[ts-reset](https://github.com/total-typescript/ts-reset) to your app.

```sh
pnpm add @buildkitgg/typescript-utils
```

Then turn on ts-reset in `tsconfig.json`, as described in [ts-reset](#ts-reset):

```json
{
  "compilerOptions": {
    "types": ["@buildkitgg/typescript-utils/reset"]
  }
}
```

```ts
import { chunk, invariant, isPresent, match, P, type SetRequired } from "@buildkitgg/typescript-utils"

type Shape = { kind: "circle"; radius: number } | { kind: "square"; size: number }

function area(shape: Shape) {
  return match(shape)
    .with({ kind: "circle" }, ({ radius }) => Math.PI * radius ** 2)
    .with({ kind: "square", size: P.number }, ({ size }) => size ** 2)
    .exhaustive()
}

function pairs(values: (number | undefined)[], config: SetRequired<{ name?: string }, "name">) {
  invariant(config.name, "config needs a name")
  return chunk(values.filter(isPresent), 2)
}
```

Every export keeps its upstream signature and documentation, and its upstream name. The one exception is
tiny-invariant's default export, which is exported as `invariant`. Bundlers drop what you don't import, since every
package involved is free of side effects.

## What's included

Everything each upstream package exports, except the exports this package deliberately leaves out where two packages
overlap. The [agent guide](./AGENTS.md) lists every export, each exclusion with its reason, and what to use instead. The
API reference links each export to its upstream source and documentation.

## ts-reset

ts-reset's recommended rules tighten built-in types across the whole program. `JSON.parse` and `response.json()` return
`unknown` instead of `any`, `.filter(Boolean)` removes falsy types, and `Array.isArray` narrows to `unknown[]`.

Turn them on by adding the reset entry point to `compilerOptions.types` in each `tsconfig.json` that type-checks your
app's code:

```json
{
  "compilerOptions": {
    "types": ["@buildkitgg/typescript-utils/reset"]
  }
}
```

Setting `types` stops TypeScript from loading every `@types` package automatically, so list the ones your project relies
on alongside it:

```json
{
  "compilerOptions": {
    "types": ["@buildkitgg/typescript-utils/reset", "node", "vite/client"]
  }
}
```

The rules also apply once any file in the program imports from `@buildkitgg/typescript-utils`, but the tsconfig entry
makes them apply from the start, whatever the code imports.

To confirm the rules apply, check that `JSON.parse` returns `unknown`:

```ts
// @ts-expect-error ts-reset types JSON.parse as unknown
const check: number = JSON.parse("1")
```

TypeScript reports an unused `@ts-expect-error` directive when the rules are off.

These are global type changes, so depend on this package from apps rather than from published libraries. A library that
imports it applies ts-reset to every app that installs the library.

## Maintaining the curation

[`curation.ts`](./curation.ts) lists the upstream packages and every exclusion. Each exclusion names the export, why it
is left out, and what to use instead. `pnpm --filter @buildkitgg/typescript-utils generate` rebuilds `src/index.ts`,
`reexports.json` and `AGENTS.md` from it, and `check:types` fails when they are out of date. After an upstream update,
regenerate and review the change to `api-reports/typescript-utils.api.md`.
