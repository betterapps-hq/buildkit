# @buildkitgg/shadcn-sync

Builds the shadcn components into a `@buildkitgg/shadcn` package inside your app, for the primitives, icon library,
style and theme you pick. The `buildkit-shadcn` command drives the real shadcn CLI, compiles the result, and links it
into `node_modules`, so your app imports components like any other package.

## Setup

Add the package, your icon library, and a `postinstall` that runs sync:

```json
{
  "dependencies": {
    "lucide-react": "^1.62.0"
  },
  "devDependencies": {
    "@buildkitgg/shadcn-sync": "^0.1.0"
  },
  "scripts": {
    "postinstall": "buildkit-shadcn sync --base base-ui --icons lucide --style nova --theme neutral"
  }
}
```

The first install fetches the registry, writes `shadcn-registry.json` beside `package.json`, and adds the generated
package to your `dependencies`:

```json
{
  "dependencies": {
    "@buildkitgg/shadcn": "link:node_modules/.buildkit/shadcn"
  }
}
```

Commit both files. Every later install, fresh clone and CI run builds from the snapshot without a network request, so
everyone gets the same components until someone runs `update`.

```tsx
import { Button, Dialog, DialogContent, DialogTrigger } from "@buildkitgg/shadcn"
import { Select } from "@buildkitgg/shadcn/select"
```

You don't install Tailwind, keep a `components.json`, or import a stylesheet. Each component brings its own CSS, so a
production build ships only the CSS of the components you import.

## Commands

| Command  | What it does                                                       | Network                                                        |
| -------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `sync`   | Builds the package from the snapshot. Runs from the `postinstall`  | Only with no snapshot, or a new `--base`, `--style`, `--theme` |
| `update` | Records a fresh snapshot from the live registry, then rebuilds     | Yes                                                            |
| `set`    | Changes settings, rebuilds, and updates the `postinstall` to match | Only for a new base, style or theme                            |

Run `update` and `set` by hand, for example `pnpm exec buildkit-shadcn set --icons phosphor`. They read the other
settings from the script that runs sync, which is the `postinstall` unless another script runs it. Run `set` with no
options to choose each setting in turn.

## Options

| Option      | Values                                                                       | Default    |
| ----------- | ---------------------------------------------------------------------------- | ---------- |
| `--base`    | `base-ui`, `radix`                                                           | `base-ui`  |
| `--icons`   | `lucide`, `tabler`, `hugeicons`, `phosphor`, `remixicon`, or an icon adapter | `lucide`   |
| `--style`   | `nova`, `vega`, `luma`, `lyra`, `maia`, `mira`, `rhea`, `sera`               | `nova`     |
| `--theme`   | A registry base color, such as `neutral`, `zinc` or `stone`                  | `neutral`  |
| `--css`     | `compiled`                                                                   | `compiled` |
| `--force`   | Rebuild even when the output is current (`sync` only)                        | `false`    |
| `--verbose` | Log each stage                                                               | `false`    |

The app installs its icon library, and `radix-ui` for `--base radix`. The components' other runtime libraries come with
this package. They resolve from the app only when they're hoisted, so a pnpm app needs `nodeLinker: hoisted`, or a
`publicHoistPattern` that covers them, in `pnpm-workspace.yaml`.

## Icon adapters

An icon adapter maps every Lucide icon the registry uses to another library. Install it as a dev dependency and pass its
package name, for example `--icons @buildkitgg/shadcn-icons-fluent`. Sync installs the components with Lucide, then
rewrites each icon import to the adapter's module for that icon.

An adapter's default export is plain data typed as `ShadcnIconAdapter`:

```ts
import type { ShadcnIconAdapter } from "@buildkitgg/shadcn-sync/adapter"

export default {
  package: "@acme/icons",
  styles: "@acme/icons/styles.css",
  icons: {
    XIcon: { name: "CloseIcon", module: "@acme/icons/close" },
    CheckIcon: { name: "TickIcon", module: "@acme/icons/tick", props: { strokeWidth: 2 } }
  }
} satisfies ShadcnIconAdapter
```

`package` is the library the app installs. `styles`, when an adapter has one, is imported into the `base` cascade layer,
so the components' utilities still win. Sync stops and names the icon and component when an adapter doesn't map an icon.

## CSS

Every stylesheet sync writes is in a cascade layer, so your own unlayered CSS overrides the components without
specificity tricks. Classes are stock shadcn, so `className` overrides merge the usual way. Because classes aren't
prefixed, a class of your own named like a Tailwind utility (`grid`, `flex`) also applies to the components.

The components don't reset your page. A small base layer gives only the elements with a `data-slot`, which every
component part has, the defaults Tailwind's Preflight would.

## Failures

Every failure exits nonzero and names its stage. A failure before the new output is in place ends with "Previous output
kept." When `CI` is set, sync never fetches and never edits `package.json`: a missing or mismatched snapshot, or a
missing dependency entry, fails with what to run locally and commit.

See the [shadcn sync plan](../../../docs/platform-planning/shadcn-sync.md) for the design.
