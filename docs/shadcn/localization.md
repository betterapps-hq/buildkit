# Text direction and labels

[shadcn components](README.md)

## Right-to-left

Wrap the app in `DirectionProvider`, and set `lang` and `dir` on the document, for example `<html lang="ar" dir="rtl">`.
The provider sets the direction the primitives use for keyboard navigation and positioning. The `dir` attribute sets the
layout, including portaled content that renders under `body`.

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

A Sheet's or Sidebar's `side` is a physical edge, so choose it by direction, for example
`side={direction === "rtl" ? "right" : "left"}`.

## Labels

The components are stock shadcn, so their built-in labels, such as a dialog's screen reader "Close", are the English
text shadcn writes. Put translated text in your own compositions, using your app's translation framework. Where a
component draws a control you need to label, turn it off and render your own, for example `showCloseButton={false}` on
`DialogContent` with a translated close button inside.

The modal and alert managers take their labels as options. See the
[modals manager](../../packages/shadcn/shadcn-modals-manager/README.md) and
[alerts manager](../../packages/shadcn/shadcn-alerts-manager/README.md).
