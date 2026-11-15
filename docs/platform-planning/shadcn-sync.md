# shadcn sync: one configurable component package

Plan to replace the per-style `@buildkitgg/shadcn-baseui-*` packages with one sync command that installs the shadcn
components with the shadcn CLI and compiles them into a package inside each app's `node_modules`, for the primitives,
icon library, style and theme the app picks.

**Status (2026-11-15):** in progress. [`@buildkitgg/shadcn-sync`](../../packages/shadcn/shadcn-sync/README.md) has
`sync`, `update` and `set`, and [`apps/shadcn-sync-example`](../../apps/shadcn-sync-example/README.md) renders its
output. See [Phases](#phases) for what's left.

## Why

- Every upstream bump means regenerating and releasing nine style packages.
- Icons are baked in at publish time, so another icon library would need a package for every style and icon combination.
- An app can't change its icon library later without changing packages.

## Owner decisions (2026-11-14)

| Decision                                                                   | What it changes                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Sync drives the shadcn CLI**                                             | Sync knows the public registry format and nothing about shadcn's repo           |
| **Each app commits a registry snapshot**                                   | Installs build from `shadcn-registry.json`; only `update` refreshes it          |
| **No class prefix**                                                        | Generated classes stay stock shadcn, so `className` overrides merge as usual    |
| **No `--components` option**                                               | Sync always builds the whole catalog                                            |
| **Icon libraries outside upstream come as adapter packages**               | Anyone can publish one; Buildkit publishes `@buildkitgg/shadcn-icons-fluent`    |
| **Sync adds the generated package to the app's `dependencies`**            | Linking the generated package is never a manual step                            |
| **Apps ship only the CSS of the components they import**                   | Per-component stylesheets whose order can't break (see [CSS](#css))             |
| **Generated output lives per project, outside the installed sync package** | Two apps, or two projects sharing a package store, never overwrite each other   |
| **Base UI or Radix, Base UI by default**                                   | `--base` picks which upstream registry style the snapshot holds                 |
| **A Tailwind mode with no duplicate rules**                                | `--css tailwind` leaves compiled CSS out; the app's own Tailwind builds it      |
| **Three commands: `sync`, `update` and `set`**                             | Updating and changing the configuration never need hand edits to `package.json` |

## Packages

| Package                   | What it is                                                                                          | Published |
| ------------------------- | --------------------------------------------------------------------------------------------------- | --------- |
| `@buildkitgg/shadcn-sync` | The `buildkit-shadcn` bin, the build pipeline around the shadcn CLI, and the icon adapter interface | Yes       |
| `@buildkitgg/shadcn`      | The generated component library, written by sync into the app and linked as a dependency            | No        |

`@buildkitgg/shadcn` never exists on npm. Its name belongs to the generated package so the import path stays
`@buildkitgg/shadcn` whatever the configuration. Reserve the name on npm so nobody else can publish it.

### What `@buildkitgg/shadcn-sync` is built with

Every library is already in the [tech stack](../tech-stack.md) or used by the current generator, so none needs a new
discussion.

| Need                           | Package                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Commands and arguments         | `citty`, as in `dev-domains` and `@buildkitgg/cli`                                             |
| The `set` prompts              | `@clack/prompts`                                                                               |
| Terminal colors                | `picocolors`                                                                                   |
| Package manager and specifiers | `package-manager-detector`                                                                     |
| Installing components          | `shadcn`, pinned to an exact version and run with the record-and-replay preload                |
| Rewriting imports and icons    | `ts-morph`                                                                                     |
| JavaScript and declarations    | `typescript`, emitting both in one pass                                                        |
| CSS                            | `tailwindcss` for compiling, `postcss` for splitting rules into layers and per-component files |

## Developer experience

The app adds the sync package and a `postinstall`:

```json
{
  "devDependencies": {
    "@buildkitgg/shadcn-sync": "^1.0.0"
  },
  "scripts": {
    "postinstall": "buildkit-shadcn sync --base base-ui --icons lucide --style nova --theme neutral"
  }
}
```

The first install fetches the registry, writes `shadcn-registry.json` beside `package.json`, and adds the generated
package (the specifier depends on the package manager, see [Dependency registration](#dependency-registration)):

```json
{
  "dependencies": {
    "@buildkitgg/shadcn": "link:node_modules/.buildkit/shadcn"
  }
}
```

The app commits both files. Every later install, fresh clone and CI run builds from the snapshot without a registry
request, so everyone gets the same components until someone runs `buildkit-shadcn update`.

The app imports from the package root or a component subpath:

```tsx
import { Button, Dialog, DialogContent, DialogTrigger } from "@buildkitgg/shadcn"
import { Select } from "@buildkitgg/shadcn/select"
```

The app doesn't install or configure Tailwind, run the shadcn CLI itself, keep a `components.json`, copy components, or
import a stylesheet. Imports never change when the configuration does. Switching between Base UI and Radix can change
component APIs, because each comes from its own upstream implementation.

## CLI

```bash
buildkit-shadcn sync [options]
buildkit-shadcn update
buildkit-shadcn set [--base <base>] [--icons <library>] [--style <style>] [--theme <theme>] [--css <mode>]
```

| Command  | What it does                                                                                       | Network                                                                    |
| -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `sync`   | Builds the package from the snapshot. Runs on every install from the `postinstall`                 | Only when there's no snapshot, or `--base`, `--style` or `--theme` changed |
| `update` | Records a fresh snapshot from the live registry and rebuilds (see [Updating](#updating))           | Yes                                                                        |
| `set`    | Changes any of the settings, in one go, and rebuilds (see [Changing settings](#changing-settings)) | Only when the base, style or theme changes                                 |

`update` and `set` are for running by hand, for example `pnpm exec buildkit-shadcn update`. They read the other options
from the script that runs sync, so nothing needs repeating. That's the `postinstall`, or another script when the app
runs sync by hand, as the example app inside this repository does: a fresh clone of the repository installs before the
sync package is built.

`sync` options, all set in the `postinstall`:

| Option      | Values                                                                            | Default    |
| ----------- | --------------------------------------------------------------------------------- | ---------- |
| `--base`    | `base-ui`, `radix`                                                                | `base-ui`  |
| `--icons`   | An upstream library id, or the package name of an icon adapter                    | `lucide`   |
| `--style`   | An upstream style: `nova`, `vega`, `luma`, `lyra`, `maia`, `mira`, `rhea`, `sera` | `nova`     |
| `--theme`   | An upstream color theme                                                           | `neutral`  |
| `--css`     | `compiled`, `tailwind` (see [CSS modes](#css-modes))                              | `compiled` |
| `--force`   | Regenerate even when the output is current                                        | `false`    |
| `--verbose` | Log each stage                                                                    | `false`    |

`update` and `set` also take `--verbose`.

The spec draft used `--theme nova`, but `nova` is a style. Styles change component classes; themes are the color
variables. Both are selectable.

Defaults stay fixed within a major version.

### What sync does

1. Parse and validate the flags.
2. Read `shadcn-registry.json`. Fetch the registry instead when the file is missing, when running `update`, or when
   `--base`, `--style` or `--theme` no longer match what the snapshot holds (see
   [Registry snapshot](#registry-snapshot)).
3. Compute a fingerprint from the flags, the snapshot hash, the sync package version, the shadcn CLI version, the icon
   library or adapter version, and the compiler versions. No timestamps.
4. If the output's manifest matches and every file in it is present and unchanged, skip to step 8.
5. Build into a staging folder (see [Pipeline](#pipeline)).
6. Validate the staging output (see [Validation](#validation)).
7. Swap the staging folder in for the previous output. A failure at any earlier step leaves the previous output alone.
8. Make sure the app's `package.json` declares the generated package and that it resolves from `node_modules`.

Sync never runs an install in the app.

## Registry snapshot

`shadcn-registry.json` holds every registry response the shadcn CLI received while installing the whole catalog, exactly
as the registry served it. It's the pin, so it's committed with the app.

```json
{
  "registry": "https://ui.shadcn.com/r",
  "style": "base-nova",
  "theme": "neutral",
  "shadcn": "4.23.0",
  "hash": "sha256-…",
  "responses": {
    "colors/neutral.json": { "…": "…" },
    "styles/base-nova/accordion.json": { "…": "…" },
    "styles/base-nova/button.json": { "…": "…" }
  }
}
```

- **Record and replay.** Sync runs the CLI with a small preload that intercepts its registry requests. With `update`, or
  when there's no snapshot, the preload passes requests through to the registry and records each response. On every
  other run it answers them from the snapshot and blocks anything else. Sync never needs to know which URLs the CLI
  fetches, so a CLI release that fetches something new keeps working the next time someone runs `update`.
- **Stable diffs.** Responses are keyed by registry path and written in sorted order, so an update diff shows only the
  items that changed.
- **CLI version.** Replay depends on the CLI asking for the same URLs, so the snapshot records the shadcn version.
  `@buildkitgg/shadcn-sync` pins the CLI exactly; when a sync release moves to a new CLI that asks for a path the
  snapshot doesn't have, sync fails and says to run `update`.
- **Icons aren't in the snapshot.** The registry serves items with the style applied but with `IconPlaceholder` still in
  place; the CLI swaps in the icon library at install time. Changing `--icons` builds from the same snapshot.
- **Base, style and theme are.** Each base and style is its own registry style (`base-nova`, `radix-vega` and so on).
  Changing them with `set`, or by editing the `postinstall`, is a deliberate configuration change, so sync records a new
  snapshot for them without needing `update`.
- **Hand edits.** `hash` covers `responses`. Sync refuses a snapshot whose responses no longer match it and says to run
  `update` or restore the file.
- **CI.** When `CI` is set, sync never fetches. A missing snapshot, or one that doesn't match the flags, fails with an
  instruction to run sync locally and commit `shadcn-registry.json`.

### Updating

```bash
pnpm exec buildkit-shadcn update
```

`update` records a fresh snapshot from the live registry, builds and validates it exactly like `sync`, and only then
writes `shadcn-registry.json` and swaps the output in. It prints which items were added, removed or changed. Whenever
the snapshot changes, it compares the items' npm dependencies (Base UI, Radix, the icon libraries and the rest) with the
app's installed versions and lists any the app needs to add or raise.

### Changing settings

`set` changes any combination of settings in one command. Pass only the ones that change; the rest stay as they are.

```bash
pnpm exec buildkit-shadcn set --icons phosphor --style vega --theme zinc
```

Run with no options, it asks for each setting in turn, with the current value selected.

1. Validate the values. Styles and themes are checked against the registry's list, so a typo fails before anything
   changes.
2. Check that the packages the new settings need are installed: the icon library (or the adapter and its library) and,
   for a new base, its primitives. If any are missing, stop and print the install command for the app's package manager.
   `set` never installs anything itself.
3. Rebuild with the new settings. A new base, style or theme needs new registry items, so `set` records a fresh
   snapshot. Icons and the CSS mode aren't in the snapshot, so changing only those rebuilds from the existing one with
   no network.
4. Only when the build passes, update the options in the `postinstall`, write the snapshot if it changed, and swap the
   output in. A failed build leaves all three alone.
5. List the packages the app no longer imports (an old icon library, or the old base's primitives) so they can be
   removed. When the base changed, warn that Base UI and Radix components can differ in their props.

The app commits `package.json` and, when it changed, `shadcn-registry.json`. Every other machine picks up the change on
its next install.

## Dependency registration

Sync registers the generated package so the app never edits `package.json` by hand.

- **Package manager.** Detected with `package-manager-detector`, as `dev-domains` already does: the
  `npm_config_user_agent` of the running install first, then the `packageManager` field and lockfile up to the workspace
  root.
- **Specifier.** The local-folder protocol each manager links rather than copies: pnpm `link:`, Yarn `portal:`, npm
  `file:`. Bun's handling of `file:` folders needs checking in phase 1.
- **Writes only when needed.** Sync changes `package.json` only when the entry is missing or points elsewhere. It keeps
  the file's indentation, key order and final newline, and adds the entry under `dependencies`.
- **First install.** The current install didn't know about the entry, so sync also creates the
  `node_modules/@buildkitgg/shadcn` link itself. It then prints that `package.json` changed and that the next install
  updates the lockfile, and that both files should be committed.
- **CI.** When `CI` is set and the entry is missing, sync fails with that instruction instead of editing the file. A
  frozen-lockfile install would fail anyway, and this message says why.
- **Workspaces.** `postinstall` runs in each app's folder, so each app registers and links its own output.
- **Every run.** After generating, sync checks that `node_modules/@buildkitgg/shadcn` resolves to the output and repairs
  the link if the package manager copied the folder or left the link dangling.

## Pipeline

| Stage        | Work                                                                                                                                                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace    | Create a temp project with a generated `components.json` (style, icon library, aliases, CSS path) and a `package.json`                                                                                                                                                                       |
| Install      | Run `shadcn add --all --yes --silent` with the record-and-replay preload. The CLI applies the icon library and writes the components. The preload turns the package-manager install the CLI starts into a no-op, because `add` has no option to skip it and sync handles dependencies itself |
| Theme        | Run `shadcn add style` with a local `registry:theme` item built from the base color the CLI fetched (`colors/<theme>.json`). The CLI writes the style's CSS imports, the theme variables and their `@theme inline` mapping, as `init` would without scaffolding a project                    |
| Icons        | For an icon adapter, map the CLI's Lucide output to the adapter's modules, and layer its stylesheet below the components' CSS (see [Icons](#icons))                                                                                                                                          |
| Imports      | Rewrite the `components.json` aliases to relative paths; fail on anything unresolved                                                                                                                                                                                                         |
| JavaScript   | Compile TSX to ES modules, keeping `"use client"` directives                                                                                                                                                                                                                                 |
| Declarations | Emit `.d.ts` with native TypeScript                                                                                                                                                                                                                                                          |
| CSS          | Compile the stylesheets with Tailwind from the installed sources and the theme item (see [CSS](#css))                                                                                                                                                                                        |
| Entries      | Write entry points, root barrel, `package.json` and `manifest.json` into the generated package                                                                                                                                                                                               |

## Generated package

Sync writes a complete package to `node_modules/.buildkit/shadcn` in the app's folder:

```text
node_modules/.buildkit/shadcn/
  package.json
  manifest.json
  index.js
  index.d.ts
  shared.css
  components/
    button/
      index.js
      index.d.ts
      styles.css
    dialog/
    ...
  ui/
    button.js
    button.d.ts
    ...
  hooks/
  lib/
```

Because the folder belongs to one project, nothing is shared through a package store, and the export map is generated to
match exactly what was built.

### Entry points

Each component entry point re-exports the upstream implementation directly. No wrappers. The stylesheets are imported by
the upstream module itself, because a bundler that honors `sideEffects` skips a re-export-only module and would drop any
CSS it imported, while a module whose exports are used keeps all its imports.

```ts
// components/button/index.js
export { Button, buttonVariants } from "../../ui/button.js"

// ui/button.js, after its "use client" directive when it has one
import "../shared.css"
import "../components/button/styles.css"
```

The root barrel re-exports every entry point. Sync fails on any export name collision instead of dropping a name; the
current generator's `SonnerToaster` rename is how collisions are resolved.

### `package.json`

```json
{
  "name": "@buildkitgg/shadcn",
  "private": true,
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": { "types": "./index.d.ts", "import": "./index.js" },
    "./button": { "types": "./components/button/index.d.ts", "import": "./components/button/index.js" }
  },
  "peerDependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@base-ui/react": "^1.0.0",
    "lucide-react": "^1.0.0"
  }
}
```

The peer list is generated from the imports the build actually contains.

### `manifest.json`

```json
{
  "generatorVersion": "1.0.0",
  "base": "base-ui",
  "icons": "lucide",
  "style": "nova",
  "theme": "neutral",
  "snapshot": "sha256-…",
  "fingerprint": "<hash>",
  "files": { "index.js": "<hash>" }
}
```

File hashes let sync notice a missing or edited file and regenerate even when the fingerprint matches.

## Runtime dependencies

The generated code imports React, the selected primitives, the selected icon library and the registry items' other
runtime libraries (cmdk, vaul, sonner, react-day-picker, embla, input-otp, recharts and so on).

- `@buildkitgg/shadcn-sync` depends on both primitive sets and those runtime libraries, so the generated package
  resolves them through the app's install. Base UI is a dependency today; `radix-ui` isn't used anywhere in the
  repository yet, so it waits for the owner's go-ahead, and an app on `--base radix` installs it itself.
- The app declares its icon library (or adapter) itself. Sync fails with the package to add when it's missing.
- React and React DOM stay peers.

The generated package is a linked folder, so its imports resolve from the app. Under pnpm's strict layout that means the
app's own dependencies plus hoisted ones; phase 1 confirms which runtime libraries need `publicHoistPattern` or must
move to the app's dependencies instead.

## Icons

The registry's `IconPlaceholder` carries names for Lucide, Tabler, Hugeicons, Phosphor and Remix Icon, and the shadcn
CLI replaces it with the library set in `components.json`. Those are the built-in `--icons` ids.

Any other library is an **icon adapter**: a package the app installs and names in `--icons`, for example
`--icons @buildkitgg/shadcn-icons-fluent`. Sync installs with Lucide, then rewrites the Lucide imports using the
adapter's mapping. Adapters are ordinary npm packages, so anyone can publish one for any icon library, and an app uses
it exactly like a built-in library.

### The adapter contract

An adapter's default export is plain data, with no runtime code, typed as `ShadcnIconAdapter` from the
`@buildkitgg/shadcn-sync/adapter` entry point:

```ts
import type { ShadcnIconAdapter } from "@buildkitgg/shadcn-sync/adapter"

export default {
  package: "@fluentui/react-icons",
  styles: "@fluentui/react-icons/headless/styles.css",
  icons: {
    ChevronDownIcon: { name: "ChevronDownRegular", module: "@fluentui/react-icons/headless/svg/chevron-down" },
    XIcon: { name: "DismissRegular", module: "@fluentui/react-icons/headless/svg/dismiss" }
  }
} satisfies ShadcnIconAdapter
```

- **`package`** is the icon library the generated components import from. The adapter declares it as a peer dependency,
  so the app installs the library itself and controls its version. Sync fails with the package to add when it's missing.
- **`icons`** maps every Lucide name the registry uses to an export (`name`) and the module that exports it (`module`),
  so a library with one module per icon works as well as one with a single entry. `props` covers a library that sizes or
  labels icons differently from Lucide.
- **`styles`** is an optional stylesheet the icons need. Sync imports it into a cascade layer below every rule it emits,
  so the components' utilities, such as `hidden` and `size-4`, still override it. A library that styles icons with
  unlayered CSS at runtime breaks those utilities, because unlayered CSS beats every layer; adapters map to icons styled
  with a static stylesheet instead.
- **Sync resolves the adapter from the app**, so it has to be in the app's `devDependencies`. It reads the mapping at
  build time; the generated package imports only the icon library, never the adapter.
- **Unmapped icons fail.** When an `update` brings an icon the adapter doesn't map, sync stops, names the icon and the
  component, and keeps the previous snapshot and output. The adapter's maintainers publish a new version with the
  mapping.
- **Coverage tests.** An adapter keeps a fixture of the Lucide icons the registry uses, and tests that every one is
  mapped, that no mapping is stale, and that every mapped export exists and renders. Sync is to export a `checkAdapter`
  helper that runs those checks against a snapshot, so other adapters don't repeat them; it isn't built yet.

### `@buildkitgg/shadcn-icons-fluent`

Buildkit's own adapter, in [`packages/shadcn/shadcn-icons-fluent`](../../packages/shadcn/shadcn-icons-fluent/README.md).
It's private until its first publish, which is done by hand like every new package.

- **Peer dependency:** `@fluentui/react-icons` 2.0.332 or later, the first release with headless icons.
- **Headless icons.** It maps to Fluent's headless entry (`@fluentui/react-icons/headless/svg/<icon>`), one module per
  icon, and names `@fluentui/react-icons/headless/styles.css` as its stylesheet. The default entry styles icons with
  Griffel, Fluent's CSS-in-JS engine, which injects unlayered rules at runtime. Its `display: inline` beat the
  accordion's `hidden` class, so both chevrons showed. The headless stylesheet holds the same defaults (inline display,
  forced colors, and the right-to-left flip) and, layered, loses to the utilities.
- **Unsized exports.** It maps to Fluent's unsized icons (`ChevronDownRegular`, not `ChevronDown16Regular`). They render
  at `1em`, so the size classes the components already put on icons (`size-4`, `[&_svg]:size-4`) control the size, as
  they do for Lucide.
- **Mapping.** The `base-nova` and `radix-nova` catalogs use the same 17 Lucide icons:

| Lucide               | Fluent                   |
| -------------------- | ------------------------ |
| `ArrowDownIcon`      | `ArrowDownRegular`       |
| `CheckIcon`          | `CheckmarkRegular`       |
| `ChevronDownIcon`    | `ChevronDownRegular`     |
| `ChevronLeftIcon`    | `ChevronLeftRegular`     |
| `ChevronRightIcon`   | `ChevronRightRegular`    |
| `ChevronUpIcon`      | `ChevronUpRegular`       |
| `CircleCheckIcon`    | `CheckmarkCircleRegular` |
| `CopyIcon`           | `CopyRegular`            |
| `InfoIcon`           | `InfoRegular`            |
| `Loader2Icon`        | `SpinnerIosRegular`      |
| `MinusIcon`          | `SubtractRegular`        |
| `MoreHorizontalIcon` | `MoreHorizontalRegular`  |
| `OctagonXIcon`       | `DismissCircleRegular`   |
| `PanelLeftIcon`      | `PanelLeftRegular`       |
| `SearchIcon`         | `SearchRegular`          |
| `TriangleAlertIcon`  | `WarningRegular`         |
| `XIcon`              | `DismissRegular`         |

The package's tests run in CI with every other package's. They read `fixtures/registry-icons.json`, recorded from both
bases with `pnpm fixture`, and fail when an icon has no replacement, a mapping is stale, or a Fluent export is missing
or doesn't render with the component's size class.

## CSS

An app ships only the CSS of the components it imports. Today's compiled stylesheet for the whole catalog is 214 KB raw
and 30 KB gzipped.

- **Per-component stylesheets.** Each component's `styles.css` holds the rules for its own classes and those of the
  shared modules it imports, such as hooks. A component it composes (Calendar's buttons, for example) imports its own
  stylesheet, so a rule appears in more than one file only when two components use the same class.
- **Order that doesn't depend on load order.** Tailwind's output is ordered: `md:px-6` has to come after `px-4` to win
  on wide screens. Split across files, that order would depend on which component the bundler loads first. So sync
  compiles the whole catalog once to get Tailwind's order and puts each rule in a sublayer of `utilities`. Every
  stylesheet starts with the same `@layer` order statement, so precedence follows the layer, not the file.
- **Coarse layers that keep the cascade.** Layers beat specificity, so sublayers are ordered by specificity first: a
  more specific rule still beats a less specific one. Within one specificity, a rule sits one layer above the highest
  earlier rule it can override (the same property, or a shorthand and its longhands, such as `padding` and
  `padding-inline`); rules that never compete share layers. The catalog needs 280 sublayers.
- **Shared stylesheet.** `shared.css` declares the layer order and holds the theme variables, the base layer, the
  keyframes and the icon adapter's stylesheet. Every component module imports it first.
- **Unused components drop out.** `sideEffects: ["**/*.css"]`, a direct re-export per entry point, and stylesheet
  imports in the component modules mean a production build includes only the components it uses and their stylesheets.
  Button alone is 6.6 KB gzipped (2.8 KB of its own and 3.9 KB shared); the example app's 15 components are 11.6 KB.
- **App CSS still wins.** Everything sync emits is layered, so the app's own unlayered CSS overrides it without
  specificity tricks.
- **No prefix.** Classes are stock shadcn, so `cn()` and tailwind-merge resolve `className` overrides the usual way. The
  flip side: an app class named like a utility, such as `grid`, also applies to the components.
- **No Preflight.** Instead, a small base layer gives elements that carry a `data-slot`, which every component part
  does, the Preflight defaults the components rely on: box sizing, margins, borders, form control fonts, list styles and
  link colors. Other elements inside components only get box sizing and the border color. Nothing resets the app's own
  elements.
- **Theme.** CSS variables on `:root` and `.dark`, from the selected theme item.
- **Portals.** Styles are plain class selectors, so portalled content is styled wherever it renders.
- **No runtime injection.** Static CSS imports only, so styles are there for the first render and for SSR.

### CSS modes

Unprefixed classes mean a Tailwind app and a precompiled stylesheet would both define `.px-4`, `.hover\:bg-accent` and
the rest. `--css` picks one source for those rules so they never exist twice.

| Mode                 | For                   | Entry points import                           | The app does                                                              |
| -------------------- | --------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| `compiled` (default) | Apps without Tailwind | `shared.css` and the component's `styles.css` | Nothing                                                                   |
| `tailwind`           | Apps with Tailwind v4 | No CSS                                        | `@import "@buildkitgg/shadcn/tailwind.css"` after `@import "tailwindcss"` |

In `tailwind` mode, sync writes `tailwind.css` instead of the compiled stylesheets. It holds:

- an `@source` pointing at the generated JavaScript, so the app's Tailwind generates the utilities the components use;
- the selected theme's variables and the `@theme inline` block that maps them to Tailwind colors and radii;
- the style's CSS and the animations.

The app's Tailwind then emits each utility once, for its own classes and the components' together, with Preflight as the
app configures it. That one import is the only setup `tailwind` mode needs; the scaffolder's templates include it.

## Validation

**On every sync:** before swapping the output in, check that every icon placeholder was replaced, every import resolves,
the declarations type-check, every export in the barrel exists, and the stylesheets compiled.

**Install tests:**

- Fresh install, repeated install and frozen-lockfile install with npm, pnpm, Yarn and Bun.
- An install from a committed snapshot makes no network requests.
- First install writes the snapshot and adds the dependency; the next install updates the lockfile; a CI run with either
  missing fails with the instruction.
- `update` rewrites the snapshot only when the new build passes; `set` changes the `postinstall` only when the new build
  passes, and an icons or CSS-only `set` makes no network requests.
- A hand-edited snapshot is refused.
- Install with scripts disabled, then `buildkit-shadcn sync` by hand recovers.
- A deleted or edited generated file is restored.
- Two apps in one workspace with different flags keep their own output.
- Two projects sharing a pnpm store, including with the global virtual store, keep their own output.
- Windows, macOS and Linux.

**Consumer tests:** a Vite app without Tailwind renders the catalog, portalled content is styled, nothing resets the
app's elements, a production build keeps the CSS, and a `className` override wins as it does in stock shadcn.

## Errors

Every failure exits nonzero and names the stage: configuration, registry, dependency, installation, compilation, CSS or
registration. A failure before the swap ends with "Previous output kept."

```text
buildkit-shadcn: "@buildkitgg/shadcn-icons-fluent" can't map ArrowUpRightIcon, used in sidebar.
Add the icon to the adapter, or pick another icon library. Previous output kept.
```

```text
buildkit-shadcn: lucide-react isn't installed. Add it to this app's dependencies, then install again.
```

```text
buildkit-shadcn: @buildkitgg/shadcn is missing from package.json, and CI is set.
Run an install locally and commit package.json and the lockfile.
```

```text
buildkit-shadcn: shadcn-registry.json is missing or doesn't match --style vega, and CI is set.
Run an install locally and commit shadcn-registry.json.
```

```text
buildkit-shadcn: shadcn-registry.json was edited by hand.
Restore it from git, or run update to fetch a fresh copy.
```

```text
buildkit-shadcn: shadcn 4.24.0 asked for styles/base-nova/registry.json, which shadcn-registry.json doesn't have.
Run update to record a fresh snapshot. Previous output kept.
```

```text
buildkit-shadcn: Can't reach https://ui.shadcn.com/r to fetch the base-nova registry.
Check your connection and try again. Previous output kept.
```

## What it replaces

- The nine `@buildkitgg/shadcn-baseui-*` packages, the `shadcn-baseui-kit` alias, and the publish-time generator in
  `packages/tooling/shadcn-generator`.
- `shadcn-alerts-manager` and `shadcn-modals-manager` peer on the generated `@buildkitgg/shadcn` and stop importing
  `lucide-react` directly.
- The "Icon library per style" row in [build-plans.md](build-plans.md).

## Phases

**Phase 1: install mechanics.** Sync package with Base UI, Lucide, nova and neutral; the registry snapshot, the `update`
command; installing through the shadcn CLI; dependency registration; the generated package for the whole catalog;
per-component stylesheets. Settle the [open questions](#open-questions). Done when a Vite app without Tailwind,
installed fresh from a committed snapshot with each package manager and no network access to the registry, imports and
renders `Button`, `Dialog`, `Input` and `Select` from `@buildkitgg/shadcn`.

Built: everything above, checked with pnpm on Windows in the example app. Left: fresh, repeated and frozen-lockfile
installs with npm, Yarn and Bun, pnpm's isolated layout outside this workspace, and macOS and Linux.

**Phase 2: configuration.** The `set` command, Radix, `--css tailwind`, every built-in icon library, every style and
theme, the adapter contract, and `@buildkitgg/shadcn-icons-fluent`. Done when changing any flag and reinstalling
regenerates the package without touching the app's imports.

Built: `set`, every style, the adapter contract and the Fluent adapter. Left: `--css tailwind`, Radix (it needs
`radix-ui`, see [Runtime dependencies](#runtime-dependencies)), checking the built-in icon libraries other than Lucide
and the themes other than neutral, and `checkAdapter`.

**Phase 3: move over.** Point the managers, apps, Storybook and scaffolder templates at the generated package, then
retire the style packages and the old generator.

## Spike results (2026-11-14)

Run on Windows with shadcn 4.23.0 and the `base-nova` style, in a temp project with a preload that recorded or replayed
registry requests and logged every other network call and child process.

- **Recording the whole catalog** (`add --all`) took about 5 seconds: 68 registry responses, 531 KB, 66 files written.
- **Replaying it offline** wrote the same 66 files with all 68 responses served from the snapshot, no other network
  calls, and exit code 0. Replaying Button and Dialog produced files identical to the recorded run.
- **Icons:** switching `iconLibrary` from Lucide to Phosphor replayed from the same snapshot with no new requests, and
  no `IconPlaceholder` was left in any file.
- **Package-manager installs:** `add` skips dependencies that `package.json` already lists by bare name, but an item
  that declares a version (`react-day-picker@latest`, `recharts@3.8.0`) always triggers an install. The preload's no-op
  install handled it.
- **Beyond item files,** the CLI fetched `colors/neutral.json` for the base color. Record and replay picked it up
  without sync knowing about it.
- **`cn` is a real package.** Components import `cn` from `cn`, shadcn's compiled replacement for clsx and
  tailwind-merge, and no `lib/utils` is written. It's a runtime dependency like the others.
- **Windows paths:** the CLI treats `D:/…` paths as URLs. Record and replay never passes local paths, so it isn't
  affected.
- **Setup notes:** `add` prints framework setup notes (wrap the app in `TooltipProvider`, for example). Sync runs it
  with `--silent`; the generated package's README should carry the providers an app needs.
- **Not covered yet:** Radix (`radix-*` styles), themes other than the base color, and macOS and Linux.

## Open questions

Answers so far, from pnpm on Windows:

1. **Linking to a folder that doesn't exist yet.** pnpm accepts it: a frozen-lockfile install with no generated folder
   leaves a dangling link, and sync fills its target. npm, Yarn and Bun still need checking.
2. **Package managers pruning `node_modules/.buildkit`.** pnpm installs leave the folder and the link alone. npm, Yarn
   and Bun still need checking.
3. **Strict resolution.** Not settled. Inside this workspace (`nodeLinker: hoisted`) everything resolves. Under pnpm's
   isolated layout the generated package can't see sync's dependencies, so the app needs them in `publicHoistPattern` or
   its own dependencies; sync names any it can't resolve.
4. **Layer granularity.** Settled: specificity-ordered sublayers, split only where rules compete (see [CSS](#css)). 280
   layers keep Tailwind's precedence for the whole catalog, with no bundler plugin.
5. **Tailwind mode subsetting.** Open, with `--css tailwind`.
6. **Theme items.** `--theme` is a registry base color for now: the CLI fetches `colors/<theme>.json`, and sync turns
   its variables into a theme item (see [Pipeline](#pipeline)). The newer `init` themes, which are separate from base
   colors, come from a dynamic endpoint that also encodes the icon library, so they aren't supported yet.
