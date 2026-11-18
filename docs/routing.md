# Route tabs and panels

Route tabs and panels keep the selected tab and the open panel in the URL, so direct links, reloads, and Back and
Forward all restore them. The URL is the only source of truth: Buildkit keeps no second selected-tab or panel-open
store, parses no router patterns, and doesn't intercept link clicks.

| Package           | Responsibility                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `router-core`     | Typed tab IDs, first-match selection, an optional display fallback, exclusions, guarded navigation, and panel dismissal |
| `react-routing`   | Subscribes with `useSyncExternalStore`, derives state during rendering, and unsubscribes on unmount                     |
| `react-router`    | React Router data-router subscriptions, using React Router's own `matchPath` and navigation                             |
| `tanstack-router` | TanStack Router subscriptions and typed destinations and params, using TanStack's own matching and navigation           |

Create one adapter per router. For SSR, create a new router and adapter per request, and initialize the client with the
same location; the adapter captures its initial location for `getServerSnapshot`. Route targets read the router's
current state when they run, so a retained `open`, `close`, or `select` never acts on stale state. No Buildkit provider
is needed, though the router's own `Link` components still need their router provider.

## Behavior

Tabs select the first matching route in configured order, so put specific matches before broad parents. An unknown route
selects no tab unless `defaultTab` supplies a display fallback. Reading state never redirects. Duplicate IDs and a
`defaultTab` that isn't one of the tabs throw. Navigation returns the router's promise so the app can handle failures.

Panels take a `route` and an explicit `closeTo` destination. Opening an open panel and closing a closed one do nothing.
`exclude` routes override a match. Closing pushes a history entry by default; set `replace` in the `closeTo` route's
navigation options to replace the entry instead. Back and Forward behave natively. A direct-linked panel can always
close without relying on an earlier in-app history entry.

React Router destinations resolve from the root. A `match` pattern may use dynamic parameters, but the destination must
be a concrete path. `preserveSearch` keeps the current query only when the destination has none. Hashes and `navigate`
options pass through to the router. The adapter needs a data router from `createBrowserRouter` or `createMemoryRouter`;
a declarative `BrowserRouter` isn't one.

TanStack destinations use TanStack's typed navigation options, including `params`, search reducers, `hash`, `replace`,
and route-relative `from` and `to`. `search: true` preserves the current search. Match options, passed as the second
argument to `route`, support fuzzy parent matches and search matching. The adapter observes completed navigation through
`onResolved`. Buildkit doesn't reproduce the router's route tree or validation.

Use the router's own `Link` components for links and modified clicks. Bind UI tabs to `activeTab` and `select`, and
drawers or dialogs to `isOpen` and `setOpen`. Your UI components own labels, focus, layout, and accessibility, so this
behavior needs no shadcn or Fluent UI package.

Buildkit has no prefetch cache or link shim. Use each router's own loading and preloading.

References: [React Router matchPath](https://reactrouter.com/api/utils/matchPath),
[TanStack Router type utilities](https://tanstack.com/router/latest/docs/framework/react/guide/type-utilities),
[TanStack navigation](https://tanstack.com/router/latest/docs/framework/react/guide/navigation).
