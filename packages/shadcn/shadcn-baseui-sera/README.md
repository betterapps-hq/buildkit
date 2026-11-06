# @buildkitgg/shadcn-baseui-sera

Generated from the pinned upstream shadcn Base UI catalog. Do not edit generated components.

Select this style once using a dependency alias:

```sh
pnpm add @buildkitgg/shadcn-baseui-kit@npm:@buildkitgg/shadcn-baseui-sera
```

```tsx
import { Button } from "@buildkitgg/shadcn-baseui-kit"
import "@buildkitgg/shadcn-baseui-kit/styles.css"
```

Buildkit's shadcn managers use the same peer dependency and inherit this selection. Import styles once at the app entry.
Use `styles-no-reset.css` when the app already supplies Tailwind's reset. Colors and light/dark mode remain customizable
through CSS variables. Style selection is installation-time, not runtime.

Tailwind 4 apps import `tailwind.css` alongside Tailwind instead of compiled styles; it registers component scanning
automatically. Apps without Tailwind import `styles.css`. Do not combine these paths or import manager stylesheets with
the Tailwind source entry.

The root exports `ShadcnLocalizationProvider` (English defaults), `useShadcnLocalization`, and `setCn`. See
[localization and RTL](https://github.com/betterapps-hq/buildkit/blob/main/docs/shadcn/localization.md) and
[styling](https://github.com/betterapps-hq/buildkit/blob/main/docs/shadcn/theming.md).

## Design tokens

Read the selected style's defaults through the same alias:

```js
import { readFile } from "node:fs/promises"
const url = import.meta.resolve("@buildkitgg/shadcn-baseui-kit/tokens.json")
const tokens = JSON.parse(await readFile(new URL(url), "utf8"))
```

`tokens.json` is a DTCG resolver (2025.10) with light and dark themes. Every token has a type and a description, and its
path is its CSS variable's name split at each hyphen (`card.foreground` is `--card-foreground`). Application CSS
overrides are not included. See
[design tokens](https://github.com/betterapps-hq/buildkit/blob/main/docs/shadcn/styles.md#design-tokens).

[Migrate from the standalone kit](https://github.com/betterapps-hq/buildkit/blob/main/docs/shadcn/migration.md).

[Setup, maintenance, and release checks](https://github.com/betterapps-hq/buildkit/blob/main/docs/shadcn/styles.md).
