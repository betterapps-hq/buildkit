# @buildkitgg/shadcn-alerts-manager

Inline alerts that stay until someone dismisses them, rendered with your app's shadcn components. Any code can raise,
update or dismiss an alert through the manager, without passing state down the tree.

## Setup

The manager renders your app's own shadcn components. Set up [`@buildkitgg/shadcn-sync`](../shadcn-sync/README.md) in
the app first, so it has a generated `@buildkitgg/shadcn`, then add the manager:

```sh
pnpm add @buildkitgg/shadcn-alerts-manager
```

The manager imports `@buildkitgg/shadcn/alert` and `@buildkitgg/shadcn/button`, which resolve to the app's generated
package, so alerts follow the app's style, theme and base. Each component brings its own CSS, so there's no stylesheet
to import. In [Tailwind mode](../shadcn-sync/README.md#tailwind-mode), the app's Tailwind builds the components'
classes.

## Usage

Create a manager, mount a region where the alerts should appear, and raise alerts from anywhere:

```tsx
import { AlertRegion, createAlertManager } from "@buildkitgg/shadcn-alerts-manager"

export const alerts = createAlertManager()

export function BillingPage() {
  return <AlertRegion manager={alerts} />
}

alerts.warning({ id: "billing", title: "Update your payment method", body: "Your card expires this month." })
```

Each alert takes a `title`, a `body`, an `action` (`{ label, onClick }`), `dismissible` and `onDismiss`. `add` takes an
`intent` of `"info"`, `"success"`, `"warning"` or `"error"`, and `info`, `success`, `warning` and `error` set it for
you.

## Managing alerts

Every call that raises an alert returns a handle for that one alert: `handle.update(patch)`, `handle.dismiss()` and
`handle.isActive`.

| Method                     | What it does                                                                      |
| -------------------------- | --------------------------------------------------------------------------------- |
| `dismissAll(region)`       | Removes the region's alerts and runs their `onDismiss` callbacks                  |
| `flush()`                  | Clears every region without running callbacks                                     |
| `dispose()`                | Clears everything without callbacks, notifies subscribers, and refuses new alerts |
| `getSnapshot`, `subscribe` | Read a region's alerts and follow changes, for your own rendering                 |

Alerts belong to a region, `"default"` unless you pass another as the last argument and to `AlertRegion`'s `region`.
Mount one `AlertRegion` per region. Every alert in a region renders; there's no hidden backlog and no timeout. For timed
feedback, use a toast instead.

Raising an alert with an ID that's already showing replaces it in place, without running its `onDismiss`, and the old
handle goes inactive. `onDismiss` runs once, after the alert is removed by the user, a handle or `dismissAll`. It
doesn't run for a replacement, `flush` or `dispose`. If callbacks throw, the manager runs the rest, then throws an
`AggregateError` with every error.

`dismissible: false` hides the dismiss control, but code can still dismiss the alert. Clicking an action doesn't dismiss
it.

Snapshots are frozen, and an update makes a new entry, so earlier snapshots don't change. Payloads and React elements
aren't deep-frozen, so treat them as immutable. On the server, snapshots are empty so one request's alerts can't leak
into another; create a manager per request rather than sharing one.

See [alert architecture and toast guidance](https://github.com/betterapps-hq/buildkit/blob/main/docs/alerts.md).

## Your own components

To render with components other than the generated ones, pass an adapter:

```tsx
import { alertComponents, createAlertManager } from "@buildkitgg/shadcn-alerts-manager"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "./components/ui/alert"
import { Button } from "./components/ui/button"

export const alerts = createAlertManager({
  adapter: alertComponents({ Alert, AlertTitle, AlertDescription, AlertAction, Button })
})
```

It works with any base, so there's no Base UI or Radix switch. `AlertAction` is optional; without it, the dismiss
control sits beside the alert's action.

## Labels and icons

The region is labeled "Notifications" and the dismiss control "Dismiss". Pass `label` and `dismissLabel` to
`AlertRegion` for translated text. See [text direction and labels](../../../docs/shadcn/localization.md).

The default alerts draw Lucide icons from `lucide-react`, which the manager depends on itself, whatever icon library the
app passes to sync. Set `--alert-success` and `--alert-warning` to tint success and warning alerts; errors use the
theme's `--destructive` color.
