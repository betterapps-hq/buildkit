# @buildkitgg/tanstack-router

Typed route tabs and panels for TanStack Router. The URL decides which tab is active and whether a panel is open, and
TanStack Router does the matching and navigation, with its typed destinations and params.

```sh
pnpm add @buildkitgg/tanstack-router @tanstack/react-router react
```

```tsx
import { createRouterAdapter, useRoutePanel } from "@buildkitgg/tanstack-router"
import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router"

const rootRoute = createRootRoute()
const peopleRoute = createRoute({ getParentRoute: () => rootRoute, path: "/people" })
const personRoute = createRoute({ getParentRoute: () => rootRoute, path: "/people/$id", component: PersonPanel })
const router = createRouter({ routeTree: rootRoute.addChildren([peopleRoute, personRoute]) })

const adapter = createRouterAdapter(router)
const person = adapter.route({ to: "/people/$id", params: { id: "42" }, search: true })
const people = adapter.route({ to: "/people", search: true })

function PersonPanel() {
  const panel = useRoutePanel(adapter, { route: person, closeTo: people })

  return (
    <dialog open={panel.isOpen}>
      <button onClick={() => void panel.close()}>Close</button>
    </dialog>
  )
}

export function App() {
  return <RouterProvider router={router} />
}
```

Route targets take TanStack Router's own navigation options, so `search`, `hash`, `replace`, and typed params work as
they do in `navigate`; `search: true` keeps the current search. The second argument to `adapter.route` takes its match
options, such as `{ fuzzy: true }` for a parent tab that stays active on child routes. State updates when a navigation
completes. Use TanStack Router's `Link` for ordinary links.

| Export                              | Behavior                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `createRouterAdapter(router)`       | Connects a router and infers its route tree. Create one per router, or per request on the server.         |
| `adapter.route(navigation, match?)` | Creates a route target. TypeScript checks the destination and its required params against the route tree. |
| `useRouteTabs`, `useRoutePanel`     | The hooks from [`@buildkitgg/react-routing`](../react-routing/README.md).                                 |

See [route tabs and panels](../../../docs/routing.md) for defaults, SSR, history, matching, and integration details.
