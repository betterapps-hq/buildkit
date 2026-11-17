# Framework integration

[shadcn components](README.md)

`@buildkitgg/shadcn` is compiled ES modules with type declarations, and each component imports its own CSS. Any bundler
that handles CSS imports from packages, such as Vite, can use it without extra configuration. Don't add it to a list of
packages to transpile.

## Vite and other client apps

Import components from `@buildkitgg/shadcn` or a component's own path, such as `@buildkitgg/shadcn/select`. There's no
stylesheet to import in the entry file unless the app uses [Tailwind mode](theming.md#tailwind-apps).

## Server rendering

Component modules keep shadcn's `"use client"` directives. A Server Component can render a component with serializable
props:

```tsx
import { Button } from "@buildkitgg/shadcn"

export default function Page() {
  return <Button>Continue</Button>
}
```

Put state, event handlers, function props and compositions such as a `render` or `asChild` element in your own
`"use client"` module. Styles are static CSS imports, so they're present for the server-rendered markup.

## Providers

Some components need a provider, as in shadcn. Tooltips need `TooltipProvider`, and toasts need `Toaster` mounted once.
See each component's page in the [shadcn docs](https://ui.shadcn.com/docs/components).

## Troubleshooting

| Symptom                                           | Check                                                                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@buildkitgg/shadcn` can't be resolved            | Run `shadcn-sync sync`, or reinstall so the `postinstall` runs                                                               |
| An app style changes a component                  | An app class named like a utility, such as `grid`, applies to components too. Rename it or scope it                          |
| A custom utility class does nothing               | In compiled mode only the components' own classes exist. Write plain CSS, or use [Tailwind mode](theming.md#tailwind-apps)   |
| A dialog uses the wrong theme                     | Put `.dark` and theme overrides on `<html>`, not an app wrapper                                                              |
| A class from the app's Tailwind theme is lost     | Pass a merger that knows it to `setCn` (see [class merging](../../packages/shadcn/shadcn-sync/README.md#class-merging))      |
| Vitest fails with `Unknown file extension ".css"` | Inline the generated package so Vite handles its CSS imports: `test.server.deps.inline: [/[/\\]\.buildkit[/\\]shadcn[/\\]/]` |
| A server and client serialization error           | Move event handlers and function props into a client component                                                               |
