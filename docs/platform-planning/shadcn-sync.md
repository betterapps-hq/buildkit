# shadcn sync: one configurable component package

Plan to replace the per-style `@buildkitgg/shadcn-baseui-*` packages with one sync command that installs the shadcn
components with the shadcn CLI and compiles them into a package inside each app's `node_modules`, for the primitives,
icon library, style and theme the app picks.

**Status (2026-11-15):** in progress. [`@buildkitgg/shadcn-sync`](../../packages/shadcn/shadcn-sync/README.md) has the
`shadcn-sync` installer and its `sync`, `update` and `set` commands, and
[`apps/shadcn-sync-example`](../../apps/shadcn-sync-example/README.md) renders its output. See [Phases](#phases) for
what's left.

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
| **Base UI, Radix or React Aria, Base UI by default**                       | `--base` picks which upstream registry style the snapshot holds                 |
| **A Tailwind mode with no duplicate rules**                                | `--css tailwind` leaves compiled CSS out; the app's own Tailwind builds it      |
| **Three commands: `sync`, `update` and `set`**                             | Updating and changing the configuration never need hand edits to `package.json` |

## Owner decisions (2026-11-15)

| Decision                                                 | What it changes                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **The command is `shadcn-sync`**                         | Same name as the package, so `pnpm dlx @buildkitgg/shadcn-sync` and the command match           |
| **Running it with no command opens an installer**        | A person at a terminal answers questions instead of writing flags (see [Installer](#installer)) |
| **Choices come from the pinned shadcn CLI's own data**   | No list of styles, themes, icon libraries or bases to maintain; no style descriptions           |
| **`--base` takes shadcn's ids: `base`, `radix`, `aria`** | Matches the shadcn CLI's own `--base`; a new upstream base needs no code change to be offered   |
| **`radix-ui` and `react-aria-components` are approved**  | The installer offers all three bases; the app installs the primitives for Radix and React Aria  |
| **No list of which components a base lacks**             | The installer never calculates or shows it; sync builds whatever the chosen base has            |

## Packages

| Package                   | What it is                                                                                      | Published |
| ------------------------- | ----------------------------------------------------------------------------------------------- | --------- |
| `@buildkitgg/shadcn-sync` | The `shadcn-sync` bin, the build pipeline around the shadcn CLI, and the icon adapter interface | Yes       |
| `@buildkitgg/shadcn`      | The generated component library, written by sync into the app and linked as a dependency        | No        |

`@buildkitgg/shadcn` never exists on npm. Its name belongs to the generated package so the import path stays
`@buildkitgg/shadcn` whatever the configuration. Reserve the name on npm so nobody else can publish it.

### What `@buildkitgg/shadcn-sync` is built with

Every library is already in the [tech stack](../tech-stack.md) or used by the current generator, so none needs a new
discussion.

| Need                           | Package                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Commands and arguments         | `citty`, as in `dev-domains` and `@buildkitgg/cli`                                             |
| The installer's questions      | `@clack/prompts`, for its prompts and spinners                                                 |
| Terminal colors                | `picocolors`                                                                                   |
| Package manager and specifiers | `package-manager-detector`                                                                     |
| Installing components          | `shadcn`, pinned to an exact version and run with the record-and-replay preload                |
| Rewriting imports and icons    | `ts-morph`                                                                                     |
| JavaScript and declarations    | `typescript`, emitting both in one pass                                                        |
| CSS                            | `tailwindcss` for compiling, `postcss` for splitting rules into layers and per-component files |

## Developer experience

The quickest start is the installer, run in the app's folder:

```bash
pnpm dlx @buildkitgg/shadcn-sync
```

It asks for the primitives, style, theme and icons, installs what they need, builds, and writes the `postinstall` (see
[Installer](#installer)). The result is the same as adding the sync package and a `postinstall` by hand:

```json
{
  "devDependencies": {
    "@buildkitgg/shadcn-sync": "^1.0.0"
  },
  "scripts": {
    "postinstall": "shadcn-sync sync --base base --icons lucide --style nova --theme neutral"
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
request, so everyone gets the same components until someone runs `shadcn-sync update`.

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
shadcn-sync [settings] [--yes]
shadcn-sync sync [settings] [--force]
shadcn-sync update
shadcn-sync set [settings] [--yes]
```

| Command  | What it does                                                                                       | Network                                                                    |
| -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| (none)   | The [installer](#installer): asks for each setting, installs what they need, builds                | For a new base, style or theme, and to look up icon adapters               |
| `sync`   | Builds the package from the snapshot. Runs on every install from the `postinstall`                 | Only when there's no snapshot, or `--base`, `--style` or `--theme` changed |
| `update` | Records a fresh snapshot from the live registry and rebuilds (see [Updating](#updating))           | Yes                                                                        |
| `set`    | Changes any of the settings, in one go, and rebuilds (see [Changing settings](#changing-settings)) | Only when the base, style or theme changes                                 |

`update` and `set` are for running by hand, for example `pnpm exec shadcn-sync update`. They read the other options from
the script that runs sync, so nothing needs repeating. That's the `postinstall`, or another script when the app runs
sync by hand, as the example app inside this repository does: a fresh clone of the repository installs before the sync
package is built.

Settings, taken by the installer, `sync` and `set`:

| Option    | Values                                                                                                  | Default    |
| --------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| `--base`  | A shadcn base: `base` (Base UI), `radix` or `aria` (React Aria)                                         | `base`     |
| `--icons` | A shadcn icon library (`lucide`, `tabler`, `hugeicons`, `phosphor`, `remixicon`), or an adapter package | `lucide`   |
| `--style` | A shadcn style: `nova`, `vega`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`                          | `nova`     |
| `--theme` | A shadcn base color: `neutral`, `stone`, `zinc`, `gray`, `mauve`, `olive`, `mist`, `taupe`              | `neutral`  |
| `--css`   | `compiled`, `tailwind` (see [CSS modes](#css-modes))                                                    | `compiled` |

The bases, styles, themes and icon libraries are read from the pinned shadcn CLI's own data (`shadcn/preset` and
`shadcn/icons`), so the lists above follow upstream whenever sync moves to a new shadcn version.

Other options:

| Option        | Commands      | What it does                                                                   |
| ------------- | ------------- | ------------------------------------------------------------------------------ |
| `--yes`, `-y` | (none), `set` | No questions: the current settings or the defaults, and install what's missing |
| `--force`     | `sync`        | Regenerate even when the output is current                                     |
| `--verbose`   | All           | Log each stage                                                                 |

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

Sync never runs an install in the app; only the installer does, after asking.

## Installer

`shadcn-sync` with no command asks what to build. `sync` also opens it when it runs at a terminal with no setting flags
in an app that has no sync script yet, and `set` with no options goes straight to its settings questions.

### When it asks

It asks only when stdin and stdout are both terminals, `CI` isn't set, and no install script is running it
(`npm_lifecycle_event` isn't `preinstall`, `install`, `postinstall` or `prepare`). Every package manager sets that
variable, so an install stays silent with no flag. A setting passed as a flag skips its question. `--yes` skips every
question: it takes the current settings, or the defaults on a first run, and installs whatever is missing. Without a
terminal and without `--yes`, a missing package fails with the install command instead.

### Screens

A first run asks four questions, then builds:

```text
┌  shadcn-sync
│
◆  Which primitives should the components use?
│  ● Base UI (Recommended)
│  ○ Radix
│  ○ React Aria
└
```

```text
│  Preview the styles at https://ui.shadcn.com/create
│
◆  Which style?
│  ● Nova
│  ○ Vega
│  ○ …
└
```

```text
◆  Which color theme?
│  ● Neutral
│  ○ Stone
│  ○ …
└
```

```text
◆  Which icons?
│  ● Lucide (lucide-react)
│  ○ Tabler Icons
│  ○ HugeIcons
│  ○ Phosphor Icons
│  ○ Remix Icon
│  ○ @buildkitgg/shadcn-icons-fluent
│  ○ Another icon adapter…
└
```

When the settings need packages the app doesn't have, it shows the command for the app's package manager and asks before
running it. "No" stops with nothing changed.

```text
◆  Install the packages these settings need?
│  pnpm add @phosphor-icons/react
│  ● Yes
│  ○ No, I'll install them myself
└
```

Each long step has its own spinner, which stops with a finished line when the next step starts:

```text
◇  Installed 1 package
◇  Downloaded components from shadcn
◇  Rewrote imports and icons
◇  Compiled JavaScript and types
◇  Compiled CSS
◇  Built 63 components
◇  Linked @buildkitgg/shadcn
```

It ends with what changed, a sample import and a link to shadcn's theme builder showing the same choices:

```text
◇  Changed ──────────────────────────────────────╮
│                                                │
│  package.json           "postinstall" script   │
│                         @buildkitgg/shadcn     │
│  shadcn-registry.json   new registry snapshot  │
│                                                │
├────────────────────────────────────────────────╯
│
│  import { Button } from "@buildkitgg/shadcn"
│
│  See your choices at https://ui.shadcn.com/create?preset=b0&base=base
│
└  Done. Commit package.json and shadcn-registry.json.
```

In an app that already has settings, it shows them and asks what to do:

```text
◇  Current settings ────╮
│                       │
│  Primitives  Base UI  │
│  Style       Nova     │
│  Theme       Neutral  │
│  Icons       Lucide   │
├───────────────────────╯
◆  What do you want to do?
│  ● Rebuild
│  ○ Change settings
│  ○ Get the latest components from shadcn
└
```

Changing settings asks the same four questions with the current answers selected, then lists each change and asks "Apply
these changes?" before installing or building. Getting the latest components runs `update` and lists what was added,
removed and changed. Ctrl+C at any question ends with "Canceled. Nothing changed."

### Where the choices come from

- **Bases, styles and themes:** `PRESET_BASES`, `PRESET_STYLES` and `PRESET_BASE_COLORS` from `shadcn/preset`. Styles
  and themes show as their id with a capital letter, as shadcn shows them. The registry's own `styles/index.json` still
  lists only New York and Default, so it isn't used, and nothing upstream describes the styles, so the installer shows
  none. Bases have a small table of names ("Base UI") and primitives packages; a base missing from it shows by its id.
- **Icon libraries:** `iconLibraries` from `shadcn/icons`, with each library's title and packages.
- **Icon adapters:** the app's installed dependencies whose `package.json` has the `shadcn-sync-icons` keyword, and
  packages with that keyword on npm, looked up with a three-second limit and skipped offline. "Another icon adapter…"
  takes any package name.
- **The theme builder link:** shadcn's own `encodePreset`, with the chosen style, theme and icon library, and the base
  as `&base=`. An adapter's icons have no preview, so the link shows Lucide.

### Installing

The installer runs the package manager's own add command, with the runtime packages in `dependencies` and the sync
package and any icon adapter in `devDependencies`. It sets `SHADCN_SYNC_SKIP` while the install runs, so the app's
`postinstall` sync skips and the installer builds once the packages are in. An adapter's icon library is known only once
the adapter is installed, so it installs that next, in the same step. When a build finds that the components import a
package the app lacks, such as the `vaul` that Radix's drawer uses, the installer offers to install it and builds again.
It writes the `postinstall` only after the build passes, after any `postinstall` the app already had.

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
pnpm exec shadcn-sync update
```

`update` records a fresh snapshot from the live registry, builds and validates it exactly like `sync`, and only then
writes `shadcn-registry.json` and swaps the output in. It prints which items were added, removed or changed. Whenever
the snapshot changes, it compares the items' npm dependencies (Base UI, Radix, the icon libraries and the rest) with the
app's installed versions and lists any the app needs to add or raise.

### Changing settings

`set` changes any combination of settings in one command. Pass only the ones that change; the rest stay as they are.

```bash
pnpm exec shadcn-sync set --icons phosphor --style vega --theme zinc
```

Run with no options, it asks for each setting in turn, with the current value selected.

1. Validate the values. Styles and themes are checked against the registry's list, so a typo fails before anything
   changes.
2. Check that the packages the new settings need are installed: the icon library (or the adapter and its library) and,
   for a new base, its primitives. If any are missing, ask before installing them at a terminal, install them with
   `--yes`, and otherwise stop and print the install command for the app's package manager.
3. Rebuild with the new settings. A new base, style or theme needs new registry items, so `set` records a fresh
   snapshot. Icons and the CSS mode aren't in the snapshot, so changing only those rebuilds from the existing one with
   no network.
4. Only when the build passes, update the options in the `postinstall`, write the snapshot if it changed, and swap the
   output in. A failed build leaves all three alone.
5. List the packages the app no longer imports (an old icon library, or the old base's primitives) so they can be
   removed. When the base changed, warn that the two bases' components can differ in their props.

The app commits `package.json` and, when it changed, `shadcn-registry.json`. Every other machine picks up the change on
its next install.

## Dependency registration

Sync registers the generated package so the app never edits `package.json` by hand.

- **Package manager.** Detected with `package-manager-detector`, as `dev-domains` already does: the
  `npm_config_user_agent` of the running install first, then the `packageManager` field and lockfile up to the workspace
  root.
- **Specifier.** The local-folder protocol each manager links rather than copies, and accepts before the folder exists:
  pnpm `link:`, Yarn `link:`, npm `file:`. Yarn's `portal:` reads the folder's manifest while resolving, so a fresh
  install would fail. Bun refuses every local protocol whose folder doesn't exist yet, so a clean frozen install would
  fail; under Bun sync adds no entry, and its own link is the only one.
- **Plug'n'Play.** Yarn's Plug'n'Play has no `node_modules`, where the output lives, and sync can't load its own
  dependencies there. The command checks for it before loading anything else and says to set `nodeLinker: node-modules`.
- **Writes only when needed.** Sync changes `package.json` only when the entry is missing or points elsewhere. It keeps
  the file's indentation, key order and final newline, and adds the entry under `dependencies`.
- **First install.** The current install didn't know about the entry, so sync also creates the
  `node_modules/@buildkitgg/shadcn` link itself. It then prints that `package.json` changed and that the next install
  updates the lockfile, and that both files should be committed. pnpm skips an install when `package.json` hasn't
  changed since the last one, and counts a change made during an install as before it. So during a pnpm install, sync
  says to run `pnpm install --config.optimistic-repeat-install=false` instead.
- **CI.** When `CI` is set and the entry is missing, sync fails with that instruction instead of editing the file. A
  frozen-lockfile install would fail anyway, and this message says why.
- **Workspaces.** `postinstall` runs in each app's folder, so each app registers and links its own output. A source-only
  workspace package that imports `@buildkitgg/shadcn` and is bundled by one app lists that app's output itself, as
  `"@buildkitgg/shadcn": "link:../../apps/web/node_modules/.buildkit/shadcn"`. Under pnpm's isolated layout it can't see
  the app's `node_modules`.
- **Strict layouts.** The generated code imports sync's own dependencies, such as `cmdk` and `recharts`, which pnpm's
  isolated layout hides from the app. Sync links each one the app can't resolve into the output's own `node_modules`,
  from sync's install. A package the app has is left to the app, so the two share one copy. React and React DOM always
  come from the app. No `publicHoistPattern` is needed. The manifest lists the packages the output needs. When the app
  adds or drops one of them, the output no longer counts as current, and the rebuild relinks it.
- **Every run.** After generating, sync checks that `node_modules/@buildkitgg/shadcn` resolves to the output and repairs
  the link if the package manager copied the folder or left the link dangling.

## Pipeline

| Stage        | Work                                                                                                                                                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace    | Create a temp project outside the app, with a generated `components.json` (style, icon library, aliases, CSS path), a `package.json`, and links to every package the build reads, from the app or else from sync (see below)                                                                 |
| Install      | Run `shadcn add --all --yes --silent` with the record-and-replay preload. The CLI applies the icon library and writes the components. The preload turns the package-manager install the CLI starts into a no-op, because `add` has no option to skip it and sync handles dependencies itself |
| Theme        | Run `shadcn add style` with a local `registry:theme` item built from the base color the CLI fetched (`colors/<theme>.json`). The CLI writes the style's CSS imports, the theme variables and their `@theme inline` mapping, as `init` would without scaffolding a project                    |
| Icons        | For an icon adapter, map the CLI's Lucide output to the adapter's modules, and layer its stylesheet below the components' CSS (see [Icons](#icons))                                                                                                                                          |
| Imports      | Rewrite the `components.json` aliases to relative paths and point `cn` imports at `lib/utils` (see [Class merging](#class-merging)); fail on anything unresolved                                                                                                                             |
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
    use-mobile.js
    use-mobile.d.ts
    ...
  lib/
    highlighter.js
    highlighter.d.ts
    highlighter.css
    utils.js
    utils.d.ts
```

Because the folder belongs to one project, nothing is shared through a package store, and the export map is generated to
match exactly what was built. Its own `node_modules` holds only the links described in
[Dependency registration](#dependency-registration).

The temp project lives in the system's temp folder rather than in the app's `node_modules`. TypeScript won't name a
package in a declaration through a path such as `node_modules/.buildkit/<folder>/node_modules`, so declarations that use
React's types or `class-variance-authority` failed to build there under pnpm's isolated layout. The temp project links
React's types too, from sync's own dependencies, so an app without `@types/react` still builds.

Every package the build needs is linked into the temp project: the app's copy when it has one, else sync's. Each
imported package's own dependencies are linked too, resolved from beside it, because a declaration can name a type the
components never import, such as React Aria's `@react-types/shared`. An unemitted `src/shadcn-sync-links.d.ts` imports
each linked package's types, so TypeScript resolves them through the links and names them by package.

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

Each module in `hooks/` and `lib/` is exported at its own path, such as `./hooks/use-mobile` and `./lib/utils`, which
points straight at the module, with no entry point in between. A module whose classes compile to rules, such as the
highlighter with its token colors, gets a stylesheet beside it and imports it the same way:

```ts
// lib/highlighter.js
import "../shared.css"
import "./highlighter.css"
```

The root barrel re-exports every component entry point and every `hooks/` and `lib/` module. Sync fails on any export
name collision instead of dropping a name; the current generator's `SonnerToaster` rename is how collisions are
resolved.

### Class merging

The registry's components import `cn` from the `cn` package, shadcn's compiled clsx and tailwind-merge. Sync points
every one of those imports at `lib/utils.js`, which it writes itself:

```ts
// lib/utils.ts
import { cn as compiledCn, type ClassValue, type CnFunction } from "cn"

let merge: CnFunction = compiledCn

export function cn(...inputs: ClassValue[]): string {
  return merge(...inputs)
}

export function setCn(next: CnFunction) {
  merge = next
}
```

An app whose Tailwind theme adds classes the default merger doesn't know calls `setCn` before the first render, with a
merger built by `createCn` from `cn/config`. Both `cn` and `setCn` are root exports. Sync fails when a module imports
anything else from `cn`, because `lib/utils.js` doesn't re-export it.

### `package.json`

```json
{
  "name": "@buildkitgg/shadcn",
  "private": true,
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": { "types": "./index.d.ts", "import": "./index.js" },
    "./button": { "types": "./components/button/index.d.ts", "import": "./components/button/index.js" },
    "./hooks/use-mobile": { "types": "./hooks/use-mobile.d.ts", "import": "./hooks/use-mobile.js" },
    "./lib/utils": { "types": "./lib/utils.d.ts", "import": "./lib/utils.js" }
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
  "base": "base",
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

- `@buildkitgg/shadcn-sync` depends on Base UI and the shared runtime libraries, and `react-is` for Recharts, whose peer
  Yarn doesn't install itself. The generated package resolves them through the app's install, or through the links sync
  makes when the layout hides them. An app on `--base radix` installs `radix-ui`, and one on `--base aria` installs
  `react-aria-components`; the installer does it after asking. A base's extra libraries, such as `vaul` for Radix, are
  installed by the app the same way.
- The app declares its icon library (or adapter) itself. Sync fails with the package to add when it's missing.
- React and React DOM stay peers.

The generated package is a linked folder, so its imports resolve from the app first. Under pnpm's isolated layout the
rest resolve through the links in the output's own `node_modules` (see
[Dependency registration](#dependency-registration)).

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
- **The `shadcn-sync-icons` keyword** in the adapter's `package.json` lets the installer list it, installed or on npm.
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
It is published to npm with the sync package.

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
  stylesheet, so a rule appears in more than one file only when two components use the same class. A `hooks/` or `lib/`
  module with classes of its own also has a stylesheet, so importing it alone still brings its CSS.
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

In `tailwind` mode, sync writes `tailwind.css` instead of the compiled stylesheets, exported as
`@buildkitgg/shadcn/tailwind.css`. It's the stylesheet the shadcn CLI left in the temp project, which is what
`shadcn init` would write into an app, with two changes: Tailwind's own import is gone, because the app imports
Tailwind, and the style's imports are inlined. It holds:

- `@source "./**/*.js"`, so the app's Tailwind scans the generated JavaScript, `lib/` included, and emits the utilities
  the components use;
- the selected theme's variables on `:root` and `.dark`, and the `@theme inline` block that maps them to Tailwind colors
  (`bg-muted`) and radii;
- the `dark` variant (`&:is(.dark *)`);
- the style's CSS: shadcn's `shadcn/tailwind.css`, with its custom variants (`data-open:`, `data-checked:` and the rest)
  and its accordion keyframes, and `tw-animate-css` for `animate-in` and friends;
- the style's base layer: the border and outline colors on every element, and the background and text colors on `body`;
- the icon adapter's stylesheet, imported into the `base` layer, when the adapter has one.

Inlining means nothing in the file resolves from `node_modules/.buildkit`, so pnpm's strict layout doesn't matter to it.
The app's own classes can use the same colors and variants. Everything else in the theme, such as `--text-sm`, stays the
app's, and nothing in `tailwind.css` sets it. Before swapping the output in, sync compiles `tailwind.css` after
`@import "tailwindcss"` with every class the components use, so a stylesheet an app's Tailwind can't read fails the
build.

The app's Tailwind then emits each utility once, for its own classes and the components' together, with Preflight as the
app configures it. That one import is the only setup `tailwind` mode needs; the scaffolder's templates include it. The
installer asks which mode to use when the app has `tailwindcss` installed.

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
- Install with scripts disabled, then `shadcn-sync sync` by hand recovers.
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
shadcn-sync: "@buildkitgg/shadcn-icons-fluent" can't map ArrowUpRightIcon, used in sidebar.
Add the icon to the adapter, or pick another icon library. Previous output kept.
```

```text
shadcn-sync: lucide-react isn't installed. Add it to this app's dependencies, then install again.
```

```text
shadcn-sync: @buildkitgg/shadcn is missing from package.json, and CI is set.
Run an install locally and commit package.json and the lockfile.
```

```text
shadcn-sync: shadcn-registry.json is missing or doesn't match --style vega, and CI is set.
Run an install locally and commit shadcn-registry.json.
```

```text
shadcn-sync: shadcn-registry.json was edited by hand.
Restore it from git, or run update to fetch a fresh copy.
```

```text
shadcn-sync: shadcn 4.24.0 asked for styles/base-nova/registry.json, which shadcn-registry.json doesn't have.
Run update to record a fresh snapshot. Previous output kept.
```

```text
shadcn-sync: Can't reach https://ui.shadcn.com/r to fetch the base-nova registry.
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

Built: everything above. Checked on Windows: the example app with pnpm, and Vite apps outside this workspace with pnpm's
isolated layout, npm, and Yarn 4.18 with `nodeLinker: node-modules`, each through fresh, repeated and frozen-lockfile
installs and a production build, and Bun the same way. Yarn's Plug'n'Play stops with a message. Left: macOS and Linux.

**Phase 2: configuration.** The `set` command, Radix, `--css tailwind`, every built-in icon library, every style and
theme, the adapter contract, and `@buildkitgg/shadcn-icons-fluent`. Done when changing any flag and reinstalling
regenerates the package without touching the app's imports.

Built: `set`, the installer, every style, all three bases, the adapter contract, the Fluent adapter, `--css tailwind`
(checked in a Vite app with `@tailwindcss/vite`), the `hooks/` and `lib/` exports, and the swappable `cn`. Radix and
React Aria build, type-check and render in a browser, including dialogs, popups, tabs and accordions. Left: checking the
built-in icon libraries other than Lucide and the themes other than neutral and zinc, and `checkAdapter`.

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
- **Not covered yet:** themes other than the base color, and macOS and Linux.

## Open questions

Answers so far, from pnpm on Windows:

1. **Linking to a folder that doesn't exist yet.** Settled for pnpm, npm and Yarn: a clean frozen install (pnpm
   `--frozen-lockfile`, `npm ci`, Yarn `--immutable` with `nodeLinker: node-modules`) leaves a dangling link, and sync
   fills its target. Yarn needs `link:` for this. Yarn 4.10 can't install sync at all, because its built-in TypeScript
   patch fails on TypeScript 7; 4.18 works. Bun accepts no local protocol for a missing folder, so it gets no entry and
   relies on sync's link; its clean frozen install passes.
2. **Package managers pruning `node_modules/.buildkit`.** Settled: repeat and forced installs with pnpm, npm and Yarn
   leave the folder and the link alone, so sync finds the output current.
3. **Strict resolution.** Settled: sync links what the components import into the output's `node_modules` (see
   [Dependency registration](#dependency-registration)), so pnpm's isolated layout needs no `publicHoistPattern`.
   Checked on Windows with pnpm 12 outside this workspace, including a source-only workspace package.
4. **Layer granularity.** Settled: specificity-ordered sublayers, split only where rules compete (see [CSS](#css)). 280
   layers keep Tailwind's precedence for the whole catalog, with no bundler plugin.
5. **Tailwind mode subsetting.** Open, with `--css tailwind`.
6. **Theme items.** `--theme` is a registry base color for now: the CLI fetches `colors/<theme>.json`, and sync turns
   its variables into a theme item (see [Pipeline](#pipeline)). The newer `init` themes, which are separate from base
   colors, come from a dynamic endpoint that also encodes the icon library, so they aren't supported yet.
