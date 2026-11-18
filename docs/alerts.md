# Inline alerts and native toasts

Use an inline alert for information that stays relevant until the user or the app resolves it, and a native toast for
brief feedback on an action. The two need different rendering and lifecycles, so Buildkit manages inline alerts and
leaves toasts to your component library's own toast queue rather than running a second one beside it.

## Package boundaries

| Package                   | Responsibility                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `alert-core`              | Generic content, independent regions, IDs, replacement, immutable snapshots, handles, callbacks, and teardown        |
| `react-alerts`            | ReactNode payloads, `useSyncExternalStore` subscription, the SSR snapshot, and adapter rendering                     |
| `shadcn-alerts-manager`   | The Alert from the app's generated `@buildkitgg/shadcn` by default, or your own components through `alertComponents` |
| `fluentui-alerts-manager` | Fluent's `MessageBar`, with the same manager and region contracts                                                    |

Both UI packages export `createAlertManager`, `AlertRegion`, and `useAlerts`, so switching between them changes only the
import. The app still supplies its UI theme and styles. An optional adapter goes to `createAlertManager`, not to
`AlertRegion`. shadcn's `alertComponents` helper accepts any components with the right props and imports no primitives
library, so it doesn't depend on Base UI or Radix. Core has no React, browser globals, DOM events, or UI dependencies.

## Design decisions

The alert packages replace the `MessageBarManager` from the `fluentui-message-bar-manager` repository. Their API isn't
backward compatible with it.

- `createAlertManager()` returns an isolated manager instead of a module singleton. An app can export its own client
  instance.
- Each region keeps its own IDs and insertion order. Raising an alert with an ID that's already showing replaces it in
  place. Dismissing runs `onDismiss`; flushing doesn't.
- Entries are frozen snapshots. Payload objects stay owned by the caller.
- A handle belongs to one generation of an entry. Replacing an ID deactivates older handles, so stale async work can't
  dismiss a newer alert. Manager methods such as `dismiss(id)` act on whichever alert holds the ID.
- Alerts have no timeout. A persistent alert has an explicit lifetime, and transient messages belong to the native toast
  manager. Leaving timers out also avoids the duplicates that surface timers create when they restart on every remount.
- Each alert surface makes its own announcement, and `AlertRegion` renders a labelled `section` rather than a live
  region. Don't wrap alert surfaces in another live region.
- `dispose()` clears without callbacks, releases subscriptions, and refuses new alerts. `flush()` clears without
  callbacks and keeps subscribers.

## Why there's no toast package

Component libraries already ship complete toast engines:

- Fluent UI's
  [`useToastController`](https://github.com/microsoft/fluentui/blob/master/packages/react-components/react-toast/library/src/state/useToastController.ts)
  dispatches, updates, dismisses, pauses, and resumes toasts.
- [shadcn's Base UI Toast](https://ui.shadcn.com/docs/components/base/toast) uses Base UI's toast manager, which
  supports [calls from outside React and promise notifications](https://base-ui.com/react/components/toast).
- [shadcn's Sonner integration](https://ui.shadcn.com/docs/components/radix/sonner) is another complete option. The
  app's generated `@buildkitgg/shadcn` exports Sonner's `Toaster` from `@buildkitgg/shadcn/sonner`, and as
  `SonnerToaster` from the package root.

These engines own timing, visibility, dismissal, positioning, and announcements. Feeding them from a shared alert queue
would create two sources of truth. A common toast facade is worth building only when an app needs one command API across
libraries, and it should delegate to the native engines rather than reimplement them. Showing and managing toasts
doesn't need one.

Storybook shows both alert adapters, core typed payloads, a headless React renderer, and custom shadcn components.
