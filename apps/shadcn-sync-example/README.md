# shadcn sync example

A Vite app without Tailwind that renders components from `@buildkitgg/shadcn`, built by
[`shadcn-sync`](../../packages/shadcn/shadcn-sync/README.md) from the committed `shadcn-registry.json`.

```bash
pnpm --filter @buildkitgg/shadcn-sync-example dev
```

`dev` and `build` run `pnpm sync` first, which replays the snapshot with no network request. Inside this repository the
app runs sync from a `sync` script rather than a `postinstall`, because a fresh clone installs before the sync package
is built.

To try the Fluent icon adapter, run this in the app's folder:

```bash
pnpm exec shadcn-sync set --icons @buildkitgg/shadcn-icons-fluent
```

`set --icons lucide` switches back. Neither needs the network, because icons aren't part of the snapshot.
