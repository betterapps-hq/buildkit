# @buildkitgg/fluentui-modals-manager

Fluent UI dialogs you can open from any code and `await`, with typed inputs and results. Confirm a deletion from an
event handler, or define a typed form modal once and open it wherever you need it.

```sh
pnpm add @buildkitgg/fluentui-modals-manager @fluentui/react-components react react-dom
```

React 19.2 or later, React DOM, and Fluent UI v9 are peer dependencies.

```tsx
import { createModalManager, ModalRenderer } from "@buildkitgg/fluentui-modals-manager"
import { FluentProvider, webLightTheme } from "@fluentui/react-components"

export const modals = createModalManager()

export function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <ModalRenderer manager={modals} />
    </FluentProvider>
  )
}

// From an event handler, a service, or any other module:
const confirmed = await modals.confirm({
  title: "Delete draft?",
  confirmLabel: "Delete",
  cancelLabel: "Keep draft"
})
```

Mount the renderer inside your `FluentProvider` so dialogs get its theme and portals. Modal state, results, updates, and
confirmation behavior come from [`@buildkitgg/react-modals`](../../react/react-modals/README.md), which every Buildkit
modal adapter shares.

## API

| Export                                      | Behavior                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `createModalManager({ labels?, adapter? })` | Creates a manager whose default adapter renders Fluent dialogs.                                                                         |
| `labels`                                    | App-wide default text for the confirm, cancel, and close buttons. Per-call `confirmLabel`, `cancelLabel`, and `closeLabel` override it. |
| `ModalRenderer`                             | Renders the manager's adapter. The default adapter finishes each exit when Fluent's dialog motion ends.                                 |

The package also re-exports `useModals` and the react-modals types, including `ModalManagerOptions`, `ModalAdapter`, and
`ModalSurfaceOptions`, and exports its own `ModalManager` and `ModalRendererProps` types.

The default dialog shows `description` under the title, marks the dialog busy while an action is pending, and returns
focus to the element that had focus when it opened. `dismissible: false` stops Escape and backdrop clicks from
dismissing it. `surfaceProps` (`className` and `style`) go to Fluent's `DialogSurface`.

To render with your own React surface, pass `adapter: { Surface: YourSurface }` to `createModalManager`. It replaces the
Fluent dialog for that manager's whole lifetime, and `ModalRenderer` still takes only `manager`. See the
[adapter contract](https://github.com/betterapps-hq/buildkit/blob/main/docs/modals.md#adapters) for what a surface must
handle.

Other adapters, such as `@buildkitgg/shadcn-modals-manager`, export the same factory, renderer props, and types, so
standard modal code moves to another component library with an import change. Update the app's styles, providers, and
any library-specific form controls at the same time, and update or remove a custom adapter.

## Update an open modal

Keep the handle to update an open modal. Standard modals take their opening options in `handle.update()`; custom
definitions take `{ data: partialState }` alongside presentation fields such as `title`, `description`, `dismissible`,
and `surfaceProps`. A function updater receives the current presentation and `current.data`, and a component's
`controls.update()` works the same way.

`title`, `body`, and `footer` accept React nodes or `{ component: Component }`. A custom footer replaces the standard
buttons, so its variants and styling are up to your components. Set `ariaLabel` when the title has no accessible text.
`onClose({ id, result, reason })` observes settlement once, and `update()` can replace it.

See [modal slots and updates](https://github.com/betterapps-hq/buildkit/blob/main/docs/modal-updates.md),
[modal packages](https://github.com/betterapps-hq/buildkit/blob/main/docs/modals.md) for lifecycle and architecture, and
the [package guide](docs/README.md).
