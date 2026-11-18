# @buildkitgg/fluentui-alerts-manager

Persistent inline alerts rendered as Fluent UI message bars. Any code can raise, update, or dismiss an alert through the
manager, including code outside React components, and the alert stays until something dismisses it.

```sh
pnpm add @buildkitgg/fluentui-alerts-manager @fluentui/react-components react react-dom
```

React 19.2 or later, React DOM, and Fluent UI v9 (`@fluentui/react-components` 9.75 or later) are peer dependencies.

## Usage

Create a manager, render a region inside your `FluentProvider`, and raise alerts from anywhere:

```tsx
import { AlertRegion, createAlertManager } from "@buildkitgg/fluentui-alerts-manager"
import { FluentProvider, webLightTheme } from "@fluentui/react-components"

export const alerts = createAlertManager()

export function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <AlertRegion manager={alerts} />
    </FluentProvider>
  )
}

// From an event handler, a service, or any other module:
alerts.warning({ id: "billing", title: "Update your payment method" })
```

Each alert renders as a `MessageBar` with the alert's `intent`, `title`, and `body`. An `action` (`{ label, onClick }`)
renders as a button, and a dismissible alert gets a dismiss button labeled with `AlertRegion`'s `dismissLabel`. To
render alerts with your own component, pass `createAlertManager({ adapter: { Alert } })`, where `Alert` takes
`AlertRendererProps`.

The package re-exports `AlertRegion`, `useAlerts`, and the alert types from
[`@buildkitgg/react-alerts`](../../react/react-alerts/README.md). Other adapters, such as
`@buildkitgg/shadcn-alerts-manager`, export the same API, so moving alerts to another component library changes only the
import.

## Behavior

The manager has [alert-core](../../core/alert-core/README.md)'s full API and lifecycle: `add`, `info`, `success`,
`warning`, and `error` return a handle to that alert, and `dismissAll`, `flush`, and `dispose` clear alerts. Alerts
belong to a region, `"default"` unless you pass another. Every alert in a region renders, with no timeout; for timed
feedback, use Fluent's toast API.

Reusing an ID replaces the alert in place without running `onDismiss`, and handles to the old alert stop working.
`dismissible: false` hides the dismiss button but doesn't block `dismiss()`, and clicking an action doesn't dismiss the
alert. Snapshots are frozen, but React elements in them aren't, so replace content with `update` instead of mutating it.
The server snapshot is empty, so create a manager per request on the server.

See [inline alerts and native toasts](https://github.com/betterapps-hq/buildkit/blob/main/docs/alerts.md) for the
architecture and toast guidance.
