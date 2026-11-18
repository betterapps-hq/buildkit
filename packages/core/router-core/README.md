# @buildkitgg/router-core

Tabs and panels whose state comes from the URL. router-core works out which tab is active and whether a panel is open,
and leaves matching and navigation to your router, so it works with any router and keeps no second copy of URL state.

```sh
pnpm add @buildkitgg/router-core
```

```ts
import { createRoutePanel, createRouteTabs, type RouteTarget } from "@buildkitgg/router-core"

// Router adapters such as @buildkitgg/react-router create targets with the router's own matching and navigation.
function target(path: string): RouteTarget {
  return {
    href: path,
    isActive: (location = window.location.pathname) => location === path,
    navigate: () => window.history.pushState(null, "", path)
  }
}

const tabs = createRouteTabs({ tabs: [{ id: "people", route: target("/people") }] })
tabs.activeTab // "people" | undefined
await tabs.select("people")

const panel = createRoutePanel({ route: target("/people/42"), closeTo: target("/people") })
panel.isOpen
await panel.close()
```

router-core has no React or router dependency. A `RouteTarget` is an `href`, an `isActive(location?)` check, and a
`navigate()` command, and the router behind it decides what they mean.

| Function                                                    | Behavior                                                                                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createRouteTabs({ tabs, defaultTab? }, location?)`         | Infers tab IDs from `tabs`. `activeTab` is the first tab whose route matches, so list specific routes before broad parents. `select(id)` navigates unless that tab is already active. |
| `createRoutePanel({ route, closeTo, exclude? }, location?)` | `isOpen` is true when `route` matches and no `exclude` target does. `open()`, `close()`, and `setOpen(isOpen)` navigate only when the panel's state would change.                     |

`defaultTab` is the tab to show when no route matches; it never redirects. Duplicate tab IDs, and a `defaultTab` that
isn't in `tabs`, throw. `closeTo` gives a panel a known place to go, so a panel opened from a direct link can close
without relying on browser history.

For React, use `@buildkitgg/react-routing`, or an adapter for your router: `@buildkitgg/react-router` or
`@buildkitgg/tanstack-router`.

See [route tabs and panels](../../../docs/routing.md) for SSR, history, matching, and integration details.
