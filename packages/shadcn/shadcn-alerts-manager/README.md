# @buildkitgg/shadcn-alerts-manager

Persistent inline alerts with external commands and shared lifecycle behavior.

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

```tsx
import { createAlertManager, AlertRegion } from "@buildkitgg/shadcn-alerts-manager"

export const alerts = createAlertManager()
<AlertRegion manager={alerts} />

alerts.warning({ id: "billing", title: "Update your payment method" })
```

## Behavior

- add / info / success / warning / error: return a region-bound handle.
- handle.update / handle.dismiss / handle.isActive: control that exact alert instance.
- getSnapshot / subscribe: stable snapshots and region-scoped notifications.
- dismissAll(region): remove alerts and invoke callbacks; flush(): clear all regions silently.
- dispose(): clear silently, notify subscribers, and reject future additions.

Alerts are persistent. Use the native toast manager for timed feedback. Reusing an ID replaces in place without invoking
dismissal; old handles become inactive. Mount once per region. For other registry components, pass
`adapter: alertComponents({ Alert, AlertTitle, AlertDescription, AlertAction, Button })`; no Base UI or Radix switch is
needed. Without `AlertAction`, the dismiss control sits beside the alert's action.

IDs are scoped to a region (default: `default`). All alerts are rendered; there is no hidden backlog or automatic
timeout. `dismissible: false` hides the dismiss control but does not prevent programmatic dismissal. Actions do not
automatically dismiss an alert. `onDismiss` runs once after removal, including `dismissAll`; it does not run for
replacement, `flush`, or `dispose`. Callback errors are collected and re-thrown as an AggregateError after all
notifications and dismissal callbacks have run.

Snapshots and entry containers are frozen. Generic payloads and React elements are not deep-frozen. Updates produce new
entries, preserving previous snapshots. Treat payloads as immutable. Server snapshots are empty to avoid leaking request
data; create stores per request, not as server singletons.

See [alert architecture and native toast guidance](https://github.com/betterapps-hq/buildkit/blob/main/docs/alerts.md).

## Labels and icons

The region is labeled "Notifications" and the dismiss control "Dismiss". Pass `label` and `dismissLabel` to
`AlertRegion` for translated text. See [text direction and labels](../../../docs/shadcn/localization.md).

The default alerts draw Lucide icons from `lucide-react`, which the manager depends on itself, whatever icon library the
app passes to sync. Set `--alert-success` and `--alert-warning` to tint success and warning alerts; errors use the
theme's `--destructive` color.
