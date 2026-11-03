# Vendored anti-slop

The anti-slop rule set runs [anti-slop](https://github.com/dmmulroy/anti-slop), an Oxlint plugin by Dillon Mulroy.
Upstream publishes no npm package and expects to be copied into the projects that use it, so `src/vendor/anti-slop`
holds a copy at a pinned commit, and the build compiles it with the rest of the package. Node can't strip TypeScript
types inside `node_modules`, so the published package ships the compiled plugin.

## Never edit vendored files

Every file in `src/vendor/anti-slop` is written by `pnpm sync:anti-slop`. `src/vendor.test.ts` compares each file with
the hashes in `snapshot.json` and fails after a hand edit. Change the rule set in `src/anti-slop.ts` instead: to turn a
rule off or configure it for everyone, set it there after the vendored rules. Lint, formatting and unused-code checks
skip the folder.

## What the sync copies

Upstream's `src/` folder, verbatim, except:

- `src/effect/`, the Effect rule group, which only applies to apps built on Effect.
- Test files.

Each TypeScript file gets a banner naming the commit and its upstream path. The upstream `LICENSE` is copied too, along
with eslint-stylistic's license for the spacing rule upstream adapted from it. Vendored files may import each other,
Node built-ins and `@oxlint/plugins`. Any other import stops the sync, because it means upstream needs a dependency this
package doesn't have.

## The rule set

`src/anti-slop.ts` registers the compiled plugin by its absolute path and turns on every rule the plugin's entry point
exports, so a rule upstream adds is on after the next sync. It also turns on `oxc/no-accumulating-spread`, which
upstream's setup enables alongside its own rules. `src/anti-slop.test.ts` checks that every rule is on, and lints
`test/fixture/slop.ts` through the source rule set and through the compiled one, from both an `oxlint.config.ts` and a
Vite+ `lint` block.

## Taking a new upstream revision

```sh
pnpm --filter @buildkitgg/oxlint-config sync:anti-slop
```

Without an argument the sync takes upstream's `main`. Pass a commit to pin another revision. Review the vendored diff,
which contains only upstream changes, and update the rule table in the [README](../README.md) for any rule that was
added, removed or changed. Then run `pnpm verify`.

Upstream pins `@oxlint/plugins` to the Oxlint version it runs with. Keep this package's `@oxlint/plugins` dependency at
the Oxlint version the repository uses, and raise the `oxlint` peer range with it.
