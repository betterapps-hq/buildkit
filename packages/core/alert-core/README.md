# @buildkitgg/alert-core

Inline alerts that stay on screen until the user or your app resolves them. alert-core keeps alerts in named regions and
gives you a handle to each one. It has no UI, React, or browser dependency, so any framework or component library can
render it.

```sh
pnpm add @buildkitgg/alert-core
```

## Usage

```ts
import { createAlertStore } from "@buildkitgg/alert-core"

const alerts = createAlertStore<{ message: string }>()
const notice = alerts.add({ body: { message: "Sync paused" } }, "account")
notice.update({ body: { message: "Sync complete" }, intent: "success" })
notice.dismiss()
```

The type argument is the payload type of `title`, `body`, and the action label, and defaults to `string`.
`@buildkitgg/react-alerts` sets it to `ReactNode`.

## API

Every `region` argument defaults to `"default"`.

| Method                                                                        | Behavior                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `add(options, region?)`                                                       | Adds an alert and returns its handle. `intent` defaults to `"info"`.                        |
| `info`, `success`, `warning`, `error`                                         | Same as `add`, with that intent.                                                            |
| `handle.update(patch)`, `handle.dismiss()`, `handle.isActive`                 | Act on the exact alert the handle created.                                                  |
| `update(id, patch, region?)`, `dismiss(id, region?)`, `isActive(id, region?)` | Act on whichever alert holds that ID.                                                       |
| `getSnapshot(region?)`, `subscribe(listener, region?)`                        | Read a region's alerts and listen for changes to that region.                               |
| `getServerSnapshot()`                                                         | Returns an empty list.                                                                      |
| `dismissAll(region?)`                                                         | Removes a region's alerts and runs their `onDismiss` callbacks.                             |
| `flush()`                                                                     | Removes the alerts in every region without running `onDismiss`. Subscribers are notified.   |
| `dispose()`                                                                   | Flushes, then drops every subscriber. Later `add` calls throw and `subscribe` does nothing. |

## Behavior

Alerts persist. There's no timeout and no hidden backlog: every alert in a region renders. For timed feedback, use your
component library's toast API.

IDs are unique within a region. Adding an alert with an ID that's in use replaces that alert in place without running
its `onDismiss`. Handles to the old alert become inactive, so stale async work can't dismiss the replacement. Render
each region in one place.

`dismissible: false` hides the dismiss control, but `dismiss()` still removes the alert. Clicking an action doesn't
dismiss the alert. `onDismiss` runs once after `dismiss` or `dismissAll` removes the alert, and doesn't run for
replacement, `flush`, or `dispose`. If a subscriber or `onDismiss` callback throws, the store runs the rest and then
throws an `AggregateError`.

Snapshots and entries are frozen, and each update creates a new entry, so earlier snapshots stay intact. Payloads aren't
deep-frozen; replace them with `update` instead of mutating them.

The server snapshot is always empty so one request's alerts can't leak into another's render. On the server, create a
store per request rather than sharing one.

See [inline alerts and native toasts](https://github.com/betterapps-hq/buildkit/blob/main/docs/alerts.md) for the
architecture and toast guidance.
