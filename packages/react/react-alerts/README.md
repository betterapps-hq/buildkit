# @buildkitgg/react-alerts

Persistent inline alerts for React that any code can raise, update, or dismiss, including code outside components. You
supply the alert component, so alerts match your component library. Adapters such as `@buildkitgg/shadcn-alerts-manager`
and `@buildkitgg/fluentui-alerts-manager` supply one for you.

```sh
pnpm add @buildkitgg/react-alerts react
```

## Usage

```tsx
import { AlertRegion, createAlertManager, type AlertRendererProps } from "@buildkitgg/react-alerts"

function Alert({ entry, dismiss, dismissLabel }: AlertRendererProps) {
  return (
    <div role="status">
      <strong>{entry.title}</strong>
      {entry.body}
      {entry.action && <button onClick={entry.action.onClick}>{entry.action.label}</button>}
      {entry.dismissible && <button onClick={dismiss}>{dismissLabel}</button>}
    </div>
  )
}

export const alerts = createAlertManager({ adapter: { Alert } })

export function App() {
  return <AlertRegion manager={alerts} />
}

// From an event handler, a service, or any other module:
alerts.warning({ id: "billing", title: "Update your payment method" })
```

## API

`createAlertManager({ adapter? })` returns an [alert-core](../../core/alert-core/README.md) store whose `title`, `body`,
and action label accept any `ReactNode`, along with the `adapter` you passed. A manager without an adapter still holds
alerts, but `AlertRegion` throws when it renders one.

`AlertRegion` renders one region's alerts with the adapter's `Alert` component, inside a `<section>` landmark. Its props
are `manager`, `region` (default `"default"`), `label` for the landmark's accessible name (default `"Notifications"`),
`dismissLabel` (default `"Dismiss"`), and `className`. The landmark doesn't announce anything, so give your `Alert`
component a live-region role such as `status`. Render each region in one place.

`useAlerts(manager, region?)` returns a region's alerts, for a renderer of your own. It uses `useSyncExternalStore`, so
neither it nor `AlertRegion` needs a context provider.

## Behavior

The manager has alert-core's full lifecycle, documented in the [alert-core README](../../core/alert-core/README.md).
Alerts persist until something dismisses them; for timed feedback, use your component library's toast API. Reusing an ID
replaces the alert in place without running `onDismiss`, and handles to the old alert stop working. `dismissible: false`
hides the dismiss button but doesn't block `dismiss()`, and clicking an action doesn't dismiss the alert. Snapshots are
frozen, but React elements in them aren't, so replace content with `update` instead of mutating it. The server snapshot
is empty, so create a manager per request on the server.

See [inline alerts and native toasts](https://github.com/betterapps-hq/buildkit/blob/main/docs/alerts.md) for the
architecture and toast guidance.
