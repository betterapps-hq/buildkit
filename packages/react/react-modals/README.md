# @buildkitgg/react-modals

Open a modal from any code in a React app and `await` the result. react-modals adds typed modal definitions, `confirm`
and `alert` helpers, and a renderer that draws the stack with your component library's dialog. Adapters such as
`@buildkitgg/shadcn-modals-manager` and `@buildkitgg/fluentui-modals-manager` supply that dialog; this package lets you
supply your own.

```sh
pnpm add @buildkitgg/react-modals react
```

## Usage

A surface component renders each modal. This one uses the native `<dialog>` element:

```tsx
import {
  createModalManager,
  ModalRenderer,
  useModalExit,
  type ModalSurfaceOptions,
  type ModalSurfaceProps
} from "@buildkitgg/react-modals"
import { useEffect, useId, useRef } from "react"

function Surface({ entry, title, body, footer, children }: ModalSurfaceProps<ModalSurfaceOptions>) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useModalExit(entry)
  useEffect(() => {
    if (entry.status === "open") {
      ref.current?.showModal()
    } else {
      ref.current?.close()
      entry.finishExit()
    }
  }, [entry])

  return (
    <dialog
      ref={ref}
      aria-label={entry.content.ariaLabel}
      aria-labelledby={entry.content.ariaLabel ? undefined : titleId}
      onCancel={(event) => {
        event.preventDefault()

        if (entry.content.dismissible !== false) {
          void entry.dismiss()
        }
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {body}
      <div>{footer}</div>
      {children}
    </dialog>
  )
}

export const modals = createModalManager({ adapter: { Surface } })

export function App() {
  return <ModalRenderer manager={modals} />
}

// From an event handler, a service, or any other module:
const confirmed = await modals.confirm({ title: "Delete draft?" }) // true or false
```

Mount one `ModalRenderer` per manager; mounting a second throws. Components inside a modal receive `data`, `controls`,
`isPending`, and `error`.

## API

| Member                                                           | Behavior                                                                                                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createModalManager({ labels?, adapter? })`                      | Creates a manager with `open`, `alert`, `confirm`, and `createModal`. `labels` sets the default confirm, cancel, and close button text.                     |
| `open(options)`, `alert(options)`                                | Open a standard modal that resolves to `undefined`.                                                                                                         |
| `confirm(options)`                                               | Opens a confirmation that resolves to `true` when confirmed and `false` otherwise.                                                                          |
| `createModal({ initialState, body, defaultResult, ...options })` | Defines a reusable modal with state inferred from `initialState`. Its `open(overrides?)` merges typed partial overrides onto fresh defaults.                |
| `controls.update(patch)`                                         | Updates presentation and custom state in one notification, with state changes under `data`. Also takes a function of the current presentation and `data`.   |
| `controls.submit(action)`                                        | Runs one action at a time, closes with its typed result on success, and keeps the modal open with `error` set on failure, ready for a retry.                |
| `beforeDismiss(data)`                                            | An optional guard, sync or async, that can cancel dismissal.                                                                                                |
| `ModalRenderer`                                                  | Renders the stack, nesting child modals in their parents. Unmounting it settles pending modals; Strict Mode remounts don't.                                 |
| `useModals(manager)`                                             | Returns the manager's entries, without a context provider.                                                                                                  |
| `useModalExit(entry)`                                            | Finishes the exit of a modal that closed before its surface rendered it open, when no exit animation will run.                                              |
| `ModalAdapter<TSurface>`                                         | `{ Surface, DefaultFooter? }`. `Surface` receives `entry`, `title`, `body`, `footer`, and nested `children`. `DefaultFooter` restyles the standard buttons. |
| `ModalSurfaceOptions`                                            | The default type of `surfaceProps`: `className` and `style`. A custom surface can declare its own type.                                                     |

`defaultResult` is what a custom modal resolves to when it's dismissed or torn down. The manager also exposes the
store's `subscribe`, `getSnapshot`, `getServerSnapshot`, `closeAll`, `clear`, and `dispose`.

## Adapters

The adapter is fixed when you create the manager. A manager without one can still open modals, but `ModalRenderer`
throws until it has one. A custom surface owns accessibility: it renders the slots, respects `dismissible`, sends
cancellation to `entry.dismiss()`, and calls `entry.finishExit()` after its exit animation. Every Buildkit modal adapter
shares this manager and renderer, so modal code moves between component libraries with an import change.

## Update an open modal

Keep the handle before awaiting its result. Standard modals patch their opening options:

```tsx
const modal = modals.open({ title: "Loading" })
modal.update({ title: "Ready", body: "Your results are available." })
await modal
```

Custom definitions use the same method, with custom state under `data`:

```tsx
const modal = editProfile.open()
modal.update({ title: "Edit Grace's profile", data: { name: "Grace" } })
modal.update(({ data }) => ({ data: { step: data.step + 1 } }))
```

Here `editProfile` is a definition with `name` and `step` in its initial state. A component's `controls.update()` works
the same way. Presentation and data each merge shallowly, in one notification, and each opening has its own values.
Closed handles ignore updates, and IDs can't change. Every slot accepts a node or `{ component: Component }`, and a
custom footer replaces the standard buttons. `onClose({ id, result, reason })` observes settlement, and `update()` can
replace it.

See [modal slots and updates](https://github.com/betterapps-hq/buildkit/blob/main/docs/modal-updates.md),
[modal packages](https://github.com/betterapps-hq/buildkit/blob/main/docs/modals.md) for lifecycle and architecture, and
the [package guide](docs/README.md).
