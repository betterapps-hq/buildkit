# @buildkitgg/shadcn-modals-manager

Open dialogs from anywhere in your app with one call, rendered with your app's shadcn components. Every modal call
returns a handle that's also a promise, so the code that opens a dialog awaits its result on the next line.

## Setup

The default renderer uses your app's own shadcn components. Set up [`@buildkitgg/shadcn-sync`](../shadcn-sync/README.md)
in the app first, so it has a generated `@buildkitgg/shadcn`, then add the manager:

```sh
pnpm add @buildkitgg/shadcn-modals-manager
```

The manager imports `@buildkitgg/shadcn/dialog` and `@buildkitgg/shadcn/button`, which resolve to the app's generated
package, so dialogs follow the app's style and theme. Each component brings its own CSS, so there's no stylesheet to
import. In [Tailwind mode](../shadcn-sync/README.md#tailwind-mode), the app's Tailwind builds the components' classes.
React and React DOM are peers.

The default renderer binds the Base UI dialog lifecycle, so it needs the app on sync's default `--base base`. With
`--base radix`, pass `radixComponents` with the generated dialog, as in [Your own components](#your-own-components). No
helper covers React Aria, so an app on `--base aria` passes its own `adapter`.

## Usage

Create a manager, mount its renderer once, and open dialogs from anywhere:

```tsx
import { createModalManager, ModalRenderer } from "@buildkitgg/shadcn-modals-manager"

export const modals = createModalManager()

export function App() {
  return <ModalRenderer manager={modals} />
}

const confirmed = await modals.confirm({ title: "Delete draft?" })
```

## Switching component libraries

`@buildkitgg/fluentui-modals-manager` exports the same `createModalManager`, `ModalRenderer`, manager types and renderer
props, so standard modal code moves between libraries by changing the import. Both renderers take only `manager`, and
`surfaceProps` supports the shared `className` and `style` fields. Your theme, stylesheet, `FluentProvider` and
library-specific form controls stay part of your UI setup.

## Your own components

Pass an adapter when you create the manager to render with other dialog components, such as the Radix ones sync builds
with `--base radix` or your own `components/ui` folder. Pick the helper for the components' underlying primitives; it
binds that library's dialog lifecycle:

```tsx
import { createModalManager, ModalRenderer, radixComponents } from "@buildkitgg/shadcn-modals-manager"
import { Button } from "@buildkitgg/shadcn/button"
import * as dialog from "@buildkitgg/shadcn/dialog"

export const modals = createModalManager({
  adapter: radixComponents({ ...dialog, Button })
})

// The renderer and modal calls stay the same
<ModalRenderer manager={modals} />
```

For Base UI components, use `baseUiComponents` in place of `radixComponents`. Both helpers take `Dialog`,
`DialogContent`, `DialogTitle`, `DialogDescription`, `DialogFooter` and `Button`.

The adapter is fixed for the manager's lifetime, and an explicit adapter wins over the package's default, including with
the Fluent factory or renderer. There's no global registration and no runtime inspection of component names. The helpers
don't import Radix, so apps on the default components don't need its types.

Wrappers must forward the props the helper passes, including children, accessibility attributes and lifecycle callbacks.
Keep native modal behavior and normal unmounting: don't force-mount a closed Radix dialog. The entry is removed after
the exit animation, from Radix's close-focus callback or Base UI's open-change-complete callback. Put styling and layout
changes inside your wrappers rather than in shared modal options.

## API

| Export                                                                             | What it is                                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `createModalManager({ labels?, adapter? })`                                        | A manager with `open`, `alert`, `confirm` and `createModal` |
| `ModalRenderer`                                                                    | Renders the manager's dialogs. Mount one per manager        |
| `baseUiComponents(components)`, `radixComponents(components)`                      | Adapters that bind a library's dialog lifecycle             |
| `ModalManager`, `ModalManagerOptions`, `ModalRendererProps`, `ModalSurfaceOptions` | Shared types                                                |
| `BaseUiModalComponents`, `RadixModalComponents`, `ModalAdapter`                    | Types for your own components                               |

Keep the handle a modal call returns to update the open dialog. Standard modals take their opening options in
`handle.update()`; custom modals take `{ data: partialState, title?, description?, dismissible?, surfaceProps? }`. A
function updater receives the current presentation and `current.data`, and every component slot's `controls.update()`
works the same way.

`title`, `body` and `footer` take React nodes or `{ component: Component }`. A custom footer replaces the default
buttons, leaving variants and styling to your components. Use `ariaLabel` when the title has no accessible text.
`onClose({ id, result, reason })` runs once when the modal settles, and you can change it with an update.

See [update examples](https://github.com/betterapps-hq/buildkit/blob/main/docs/modal-updates.md),
[lifecycle and architecture](https://github.com/betterapps-hq/buildkit/blob/main/docs/modals.md),
[typed forms](https://github.com/betterapps-hq/buildkit/blob/main/docs/modal-forms.md) and the
[package guide](docs/README.md).

## Labels

The default buttons read "Confirm", "Cancel" and "Close". Pass `labels` to `createModalManager` for translated text, or
`confirmLabel`, `cancelLabel` and `closeLabel` to a single modal, which take precedence. See
[text direction and labels](../../../docs/shadcn/localization.md).
