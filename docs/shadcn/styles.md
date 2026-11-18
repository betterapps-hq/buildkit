# Choosing what sync builds

[shadcn components](README.md)

Sync builds the whole shadcn catalog for one set of choices: primitives, style, theme, icons, CSS and text direction.
The installer asks for all of them except direction, which you set with `--direction` when you need it. The
`postinstall` records the choices as flags, leaving out `--css` and `--direction` while they're the defaults:

```json
{
  "scripts": {
    "postinstall": "shadcn-sync sync --base base --icons lucide --style nova --theme neutral"
  }
}
```

The bases, styles, themes and built-in icon libraries come from the shadcn CLI that sync pins, so they follow shadcn's
own lists. See the [options table](../../packages/shadcn/shadcn-sync/README.md#options) for every value.

## Primitives

`--base` picks the upstream implementation: `base` (Base UI, the default), `radix` or `aria` (React Aria). The app
installs the base's primitives: `@base-ui/react`, `radix-ui` or `react-aria-components`. Each base has its own component
APIs, such as Base UI's `render` prop and Radix's `asChild`, so changing it can mean changing how the app composes
components. Sync builds whatever components the chosen base has.

## Style and theme

`--style` picks a shadcn style. Styles change layout and component classes as well as colors, so they aren't just
palettes. `--theme` picks the color theme, which sets the CSS variables. Override those variables to brand an app (see
[theming](theming.md)).

## Icons

`--icons` takes a built-in icon library, such as `lucide` or `phosphor`, or the package name of an icon adapter, such as
[`@buildkitgg/shadcn-icons-fluent`](../../packages/shadcn/shadcn-icons-fluent/README.md). The app installs the icon
library itself. See [icon adapters](../../packages/shadcn/shadcn-sync/README.md#icon-adapters) to publish one.

## CSS

`--css compiled`, the default, has sync compile each component's CSS, so the app needs no Tailwind. An app that already
runs Tailwind v4 can pass `--css tailwind` and import `@buildkitgg/shadcn/tailwind.css` after Tailwind, so each class is
built once (see [Tailwind mode](../../packages/shadcn/shadcn-sync/README.md#tailwind-mode)).

## Text direction

`--direction rtl` has the shadcn CLI write logical classes that follow the page's `dir`, for apps in right-to-left
languages. See [text direction and labels](localization.md).

## Changing a choice

Run `set` with the new value. It rebuilds the package and updates the `postinstall`. At a terminal it also asks for the
settings you didn't pass and confirms; add `--yes` to apply the flags as they are:

```sh
pnpm exec shadcn-sync set --icons phosphor
```

A new base, style or theme fetches the registry once. Run `update` to record the latest components from the registry.
Commit the changed `shadcn-registry.json` and `package.json`.
