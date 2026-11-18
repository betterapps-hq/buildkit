# @buildkitgg/cli

The `buildkit` CLI creates Buildkit apps and keeps them current: add an add-on, change an option, or move to a newer
catalog without losing your edits. It runs the project commands of [`@buildkitgg/scaffolder`](../scaffolder/README.md)
on [Buildkit's catalog](../catalog/README.md).

Requires Node.js 24 or later.

## Create an app

```sh
npx @buildkitgg/cli create app my-app
```

In a terminal it asks for the mode and localization, shows the plan, and asks once before it writes anything. Once the
app is written, it offers to install dependencies, build, and make a first git commit when the folder isn't in a
repository yet. The same answers work as flags:

```sh
npx @buildkitgg/cli create app my-app --mode ssr --with i18n --set i18n.locales=en,fr --yes
```

`--yes` accepts every default but never makes a decision for you, and `--json` prints one JSON envelope without
prompting. Without a terminal, a command plans and writes nothing unless you pass `--yes`.

## Change an app

Every app pins `@buildkitgg/cli` as a dev dependency, so run it through pnpm inside the project:

| Command                                          | What it does                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `pnpm buildkit add i18n`                         | Add an add-on                                                        |
| `pnpm buildkit config set i18n.locales=en,fr,de` | Change an option                                                     |
| `pnpm buildkit upgrade`                          | Move to the installed catalog, merging template fixes into your code |
| `pnpm buildkit check`                            | Fail when generated files or the lock are out of date                |
| `pnpm buildkit status`, `explain <path>`         | What Buildkit manages, and who contributes a file                    |
| `pnpm buildkit catalog --json`                   | Every template, question and add-on                                  |

The other commands are `sync`, `plan show`, `schema` and `recover`. Every planning command takes `--dry-run`, `--json`,
`--out`, `--plan` and `--yes`, and the [scaffolder's command reference](../scaffolder/README.md#commands) lists the
rest. Exit codes: 0 done, 1 needs a decision, 2 usage or internal error, 3 conflict, 4 drift, 5 locked, 6 applied but a
setup step failed, 130 cancelled.

To upgrade, cache the catalog version the app was made with, install the newer CLI, then run `upgrade`:

```sh
pnpm buildkit catalog fetch <version> # the catalog version in .buildkit/lock.json
pnpm add -D @buildkitgg/cli@latest
pnpm buildkit upgrade
```

`upgrade` merges template changes into the starter files you've edited by comparing them with that cached version.
Without it, a starter file you edited that the new catalog also changes is a conflict.

## Embedding

```ts
import { runBuildkit } from "@buildkitgg/cli"

const code = await runBuildkit(["add", "i18n", "--json", "--yes"], { io: { cwd: "path/to/app" } })
```

`buildkitOptions(overrides)` returns the options `runBuildkit` passes to the scaffolder's `runCli`.

## Smoke test

`pnpm --filter @buildkitgg/cli test:smoke` generates apps with the built CLI, installs them with the Buildkit packages
packed from the checkout, then runs `buildkit check`, lint, format check, build and type-check, and requests pages from
the built server. Build first with `pnpm exec vp run --cache --filter "@buildkitgg/cli..." build`.
