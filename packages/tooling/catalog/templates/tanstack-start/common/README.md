# Your Buildkit app

A React app on [TanStack Start](https://tanstack.com/start), made with Buildkit.

## Run it

Requires Node.js 24 or later and pnpm 12.

```sh
pnpm install
pnpm dev
```

## Check and build

```sh
pnpm lint
pnpm format:check
pnpm build
pnpm typecheck
```

`pnpm build` also writes `src/routeTree.gen.ts`, the route tree that `pnpm typecheck` reads. Commit it.

## What Buildkit manages

`buildkit.jsonc` records the template and the add-ons you chose, and `.buildkit/lock.json` records what Buildkit wrote.
Commit both.

- `pnpm buildkit add <add-on>` adds an add-on, such as `pnpm buildkit add i18n`.
- `pnpm buildkit config set <add-on>.<option>=<value>` changes an option.
- `pnpm buildkit check` fails when generated files or the lock are out of date.

Files under `src/generated/buildkit/` are generated. Your starter files import them, so an add-on wires itself in
through them and never edits your starter files.

## Upgrade

```sh
pnpm buildkit catalog fetch <version> # the catalog version in .buildkit/lock.json
pnpm add -D @buildkitgg/cli@latest
pnpm buildkit upgrade
```

`upgrade` moves the app to the Buildkit catalog you installed and merges template fixes into the starter files, keeping
your edits. Where your edits and its changes overlap, it stops and lists each conflict. Answer one with
`--resolve <id>=keep-current` or `--resolve <id>=take-incoming`, or pass `--conflict markers` to write conflict markers
into the file and settle it by hand.
