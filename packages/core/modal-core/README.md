# @buildkitgg/modal-core

A modal stack with typed, awaitable results. Open a modal from any code, `await` what the user chose, and draw the stack
with any framework or component library: modal-core doesn't import React, touch the DOM, or set animation timers.

```sh
pnpm add @buildkitgg/modal-core
```

```ts
import { createModalStore } from "@buildkitgg/modal-core"

const modals = createModalStore<string>()
const handle = modals.open({
  defaultResult: false,
  createContent: () => "Delete draft?"
})
handle.update(() => "Delete this draft permanently?")
handle.close(true)
const confirmed = await handle // true
// A renderer calls entry.finishExit() after its exit animation.
```

The type argument is the content type, which the store never inspects. `defaultResult` is the result whenever the modal
closes without `close(result)` or a successful `submit`. `@buildkitgg/react-modals` builds typed React modal definitions
on this store.

## API

| Member                                 | Behavior                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `createModalStore<TContent>()`         | Creates an isolated, observable stack.                                                                                                       |
| `open(options)`                        | Opens a modal and returns a handle you can `await`. A modal opened while another is open becomes its child.                                  |
| `handle.close(result)`                 | Completes with `result`, skipping `beforeDismiss`.                                                                                           |
| `handle.dismiss()`                     | Runs `beforeDismiss`, if set, then closes with `defaultResult`. Resolves to whether the modal closed.                                        |
| `handle.submit(action)`                | Runs one action at a time and exposes `isPending` and `error` on the entry. Success closes with the action's result; failure leaves it open. |
| `handle.update(current => next)`       | Replaces the content and notifies subscribers if the value changed. It isn't a partial merge, so return a new object for object content.     |
| `handle.isActive()`                    | Returns whether the modal is still open.                                                                                                     |
| `closeAll()`                           | Closes every open modal with its default result and keeps the entries for their exit animations.                                             |
| `clear()`, `dispose()`                 | Settle every pending result and remove all entries. `dispose()` also drops subscribers, and later `open` and `subscribe` calls throw.        |
| `getSnapshot()`, `subscribe(listener)` | Read the stack and listen for changes.                                                                                                       |
| `getServerSnapshot()`                  | Returns an empty stack.                                                                                                                      |

## Lifecycle

An entry moves from `open` to `closing`, and the renderer calls `entry.finishExit()` to remove it when its exit
animation ends. A blank or duplicate ID throws, and an ID stays reserved until its exit finishes. Each result settles
once. Closing a modal also closes its descendants with their default results. Closed handles ignore updates. Keep the
handle to update a modal; there's no update-by-ID method.

`beforeDismiss` returns a boolean or a promise of one. If the content changes while the guard runs, its approval doesn't
count and the modal stays open. `close`, `closeAll`, `clear`, `dispose`, and closing a parent skip the guard.

Pass `onClose({ id, result, reason })` to `open` to observe settlement. It runs once, after subscribers see the new
snapshot, and can't veto the closure. `reason` is `completed`, `dismissed`, `parent-closed`, `close-all`, `cleared`, or
`disposed`. If an observer throws, the others still run, results stay settled, and the store then throws an
`AggregateError`.

Snapshots are frozen and the server snapshot is always empty. Create one store per application, or one per request on
the server.

See [modal slots and updates](https://github.com/betterapps-hq/buildkit/blob/main/docs/modal-updates.md), including
[close reasons](https://github.com/betterapps-hq/buildkit/blob/main/docs/modal-updates.md#close-telemetry),
[modal packages](https://github.com/betterapps-hq/buildkit/blob/main/docs/modals.md) for lifecycle and architecture, and
the [package guide](docs/README.md).
