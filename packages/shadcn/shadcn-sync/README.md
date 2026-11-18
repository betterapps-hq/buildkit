# @buildkitgg/shadcn-sync

Builds the shadcn components into a `@buildkitgg/shadcn` package inside your app, for the primitives, icon library,
style and theme you pick. The `shadcn-sync` command drives the real shadcn CLI, compiles the result, and links it into
`node_modules`, so your app imports components like any other package.

## Setup

Run the installer in your app's folder:

```bash
pnpm dlx @buildkitgg/shadcn-sync
```

It asks which primitives, style, color theme and icons you want, installs the packages they need after asking, builds
the components, and adds a `postinstall` that runs sync. It ends with a link to shadcn's theme builder showing your
choices.

To set it up by hand instead, add the package, your icon library, and the `postinstall`:

```json
{
  "dependencies": {
    "lucide-react": "^1.62.0"
  },
  "devDependencies": {
    "@buildkitgg/shadcn-sync": "^0.2.0"
  },
  "scripts": {
    "postinstall": "shadcn-sync sync --base base --icons lucide --style nova --theme neutral"
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

Commit both files with the lockfile. Every later install, fresh clone and CI run builds from the snapshot without a
network request, so everyone gets the same components until someone runs `update`. With npm the entry is
`file:node_modules/.buildkit/shadcn`.

```tsx
import { Button, Dialog, DialogContent, DialogTrigger } from "@buildkitgg/shadcn"
import { Select } from "@buildkitgg/shadcn/select"
```

shadcn's hooks and helpers are exported too, from the root and from their own paths:

```tsx
import { cn, useHighlightedCode, useIsMobile } from "@buildkitgg/shadcn"
import { highlightCode } from "@buildkitgg/shadcn/lib/highlighter"
```

Each module in shadcn's `hooks/` and `lib/` folders has a path to match, such as `@buildkitgg/shadcn/hooks/use-mobile`
and `@buildkitgg/shadcn/lib/utils`.

You don't install Tailwind, keep a `components.json`, or import a stylesheet. Each component brings its own CSS, so a
production build ships only the CSS of the components you import. So does a helper that renders classes, such as the
highlighter's token colors. An app that already runs Tailwind can build the components' classes itself instead (see
[Tailwind mode](#tailwind-mode)).

## Commands

| Command  | What it does                                                       | Network                                                                |
| -------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| (none)   | Asks for each setting, installs the packages they need, and builds | For a new base, style or theme, to find icon adapters, and to install  |
| `sync`   | Builds the package from the snapshot. Runs from the `postinstall`  | Only with no snapshot, or a new `--base`, `--style` or `--theme`       |
| `update` | Records a fresh snapshot from the live registry, then rebuilds     | Yes                                                                    |
| `set`    | Changes settings, rebuilds, and updates the `postinstall` to match | For a new base, style or theme, and to find icon adapters when it asks |

Run `shadcn-sync` with no command again in a set-up app to rebuild, change settings, or get the latest components. At a
terminal, `sync` in an app that isn't set up yet runs the installer.

Run `update` and `set` by hand, for example `pnpm exec shadcn-sync set --icons phosphor`. They read the other settings
from the script that runs sync, which is the `postinstall` unless another script runs it. At a terminal, `set` asks for
each setting you didn't pass, except direction, and confirms before it applies them.

The CLI asks questions only at a terminal, outside CI, and never during an install. A setting passed as a flag skips its
question, and `--yes` skips them all and installs whatever is missing.

## Options

| Option        | Values                                                                       | Default    |
| ------------- | ---------------------------------------------------------------------------- | ---------- |
| `--base`      | `base` (Base UI), `radix`, `aria` (React Aria)                               | `base`     |
| `--icons`     | `lucide`, `tabler`, `hugeicons`, `phosphor`, `remixicon`, or an icon adapter | `lucide`   |
| `--style`     | `nova`, `vega`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`               | `nova`     |
| `--theme`     | `neutral`, `stone`, `zinc`, `gray`, `mauve`, `olive`, `mist`, `taupe`        | `neutral`  |
| `--css`       | `compiled`, `tailwind` (see [CSS](#css))                                     | `compiled` |
| `--direction` | `ltr`, `rtl` (see [Right to left](#right-to-left))                           | `ltr`      |
| `--yes`, `-y` | Don't ask; install what's missing (installer and `set`)                      | `false`    |
| `--force`     | Rebuild even when the output is current (`sync` only)                        | `false`    |
| `--verbose`   | Log each stage                                                               | `false`    |

The bases, styles, themes and icon libraries come from the shadcn CLI this package pins, so they follow shadcn's own
lists.

The app installs its icon library and the base's primitives (`@base-ui/react`, `radix-ui` or `react-aria-components`),
along with any library only that base uses, such as `vaul` for Radix. The installer offers to install each of them. The
components' other runtime libraries come with this package, and sync links them into the generated package when your app
can't resolve them (see [Package managers](#package-managers)).

## Icon adapters

An icon adapter maps every Lucide icon the registry uses to another library. Install it as a dev dependency and pass its
package name, for example `--icons @buildkitgg/shadcn-icons-fluent`. Sync installs the components with Lucide, then
rewrites each icon import to the adapter's module for that icon.

The installer lists adapters that have the `shadcn-sync-icons` keyword in their `package.json`, whether the app has them
installed or they're on npm. An adapter's default export is plain data typed as `ShadcnIconAdapter`:

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

Classes are stock shadcn, so `className` overrides merge the usual way.

By default, sync compiles the CSS itself (`--css compiled`). Every stylesheet it writes is in a cascade layer, so your
own unlayered CSS overrides the components without specificity tricks. Because classes aren't prefixed, a class of your
own named like a Tailwind utility (`grid`, `flex`) also applies to the components.

The compiled CSS doesn't reset your page. A small base layer gives only the elements with a `data-slot`, which every
component part has, the defaults Tailwind's Preflight would.

### Tailwind mode

An app with Tailwind v4 can pass `--css tailwind`, so its own Tailwind builds the components' classes along with the
app's, and each class is emitted once. The components then import no CSS. Import the generated stylesheet after Tailwind
in the app's stylesheet instead:

```css
@import "tailwindcss";
@import "@buildkitgg/shadcn/tailwind.css";
```

It holds what `shadcn init` would add to the app's stylesheet:

- an `@source` for the generated JavaScript, so Tailwind finds the components' classes;
- the theme's variables on `:root` and `.dark`, and the `@theme inline` block that maps them to colors such as
  `bg-muted` and to radii;
- the `dark` variant, and shadcn's own variants such as `data-open:`;
- the animations, and the style's base layer, which sets the border color and the page's background and text colors;
- the icon adapter's stylesheet, when the adapter has one.

The app's own classes can use all of these too. Preflight and the rest of the theme stay the app's own. Tailwind scans
the whole generated package, so the app's CSS holds the classes of every component, not just the ones it imports. The
installer asks for this mode when the app has Tailwind installed.

## Right to left

With `--direction rtl`, the shadcn CLI writes logical classes (`ms-2`, `start-0`, `ps-3`) instead of left and right
ones, and flips directional icons with `rtl:`, so the components follow the page's `dir`. Set `dir="rtl"` on the page,
or wrap the app in `DirectionProvider` from `@buildkitgg/shadcn` for the components that read the direction in
JavaScript. Strings the components write themselves, such as a dialog's "Close", stay English as in stock shadcn: pass
your own `aria-label` or children where a component takes them.

## Class merging

The components merge `className` overrides with `cn`, which uses shadcn's compiled Tailwind merger by default. If your
Tailwind theme adds classes that merger doesn't know, such as a `text-2xs` font size, pass your own merger to `setCn`
before the first render. Every component then merges with it. Add `cn` to your app's dependencies to import its
`createCn`:

```ts
import { setCn } from "@buildkitgg/shadcn"
import { createCn } from "cn/config"

setCn(createCn({ extend: { classGroups: { "font-size": [{ text: ["2xs"] }] } } }))
```

`cn` from `@buildkitgg/shadcn` always uses the current merger, so your own components can merge classes the same way.

## Package managers

Sync works with npm, pnpm, Yarn and Bun, including frozen-lockfile installs on a fresh clone. With pnpm, run
`pnpm install --config.optimistic-repeat-install=false` once after the first install. pnpm skips an install when
`package.json` hasn't changed since the last one, and sync adds the generated package during the first.

| Package manager | What to know                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm            | The isolated layout needs no hoisting settings. Sync links any package the components import that the app can't resolve into the generated package. A package your app has, such as Base UI, is left to it, so both use one copy |
| Yarn            | Needs `nodeLinker: node-modules`, because the generated package lives in `node_modules`. Under Plug'n'Play, sync stops and says to switch. Tested with Yarn 4.18                                                                 |
| Bun             | Bun won't install a local folder that doesn't exist yet, so sync adds no `package.json` entry. Its own `node_modules/@buildkitgg/shadcn` link, which it checks on every run, is the only one                                     |

Sync type-checks the components with its own copy of React's types, so its build doesn't depend on your app's
`@types/react`. Your app still needs `@types/react` to type-check its own code against the components.

In a monorepo, each app that runs sync gets its own generated package. A source-only workspace package that an app
bundles, and that imports `@buildkitgg/shadcn`, lists that app's generated package as its own dependency:

```json
{
  "dependencies": {
    "@buildkitgg/shadcn": "link:../../apps/web/node_modules/.buildkit/shadcn"
  }
}
```

## Failures

Every failure exits nonzero. A failure during the build leaves the last good package in place and says "Previous output
kept." When `CI` is set, sync never fetches and never edits `package.json`: a missing or mismatched snapshot, or a
missing dependency entry, fails with what to run locally and commit.

See the [shadcn sync plan](../../../docs/platform-planning/shadcn-sync.md) for the design.
