# Text direction and labels

[shadcn components](README.md)

## Right to left

Build the components for right to left with `--direction rtl`:

```sh
pnpm exec shadcn-sync set --direction rtl
```

The shadcn CLI then writes logical classes such as `ms-2` and `ps-3` in place of left and right ones, and flips
directional icons with `rtl:`. The components lay out by the page's direction, so set `lang` and `dir` on the document,
for example `<html lang="ar" dir="rtl">`. Dialogs, menus and other portaled content render under `body`, so they follow
the document too.

Wrap the app in `DirectionProvider` as well. The primitives read the direction from it for keyboard navigation and
positioning:

```tsx
import { DirectionProvider } from "@buildkitgg/shadcn"

export function Root() {
  return (
    <DirectionProvider direction="rtl">
      <App />
    </DirectionProvider>
  )
}
```

`DirectionProvider` comes from the base's primitives, so its props follow the base. The example uses Base UI's.

A Sheet's or Sidebar's `side` names a physical edge, so choose it by direction, for example
`side={direction === "rtl" ? "right" : "left"}`.

## Labels

The components are stock shadcn, so their built-in labels are the English text shadcn writes, such as a dialog's screen
reader "Close". Put translated text in your own compositions with your app's translation framework. Where a component
draws a control you need to label, turn it off and render your own, for example `showCloseButton={false}` on
`DialogContent` with a translated close button inside.

The modal and alert managers take their labels as options. See the
[modals manager](../../packages/shadcn/shadcn-modals-manager/README.md) and
[alerts manager](../../packages/shadcn/shadcn-alerts-manager/README.md).
