# @buildkitgg/react-router

Route tabs and panels for React Router data routers. The URL decides which tab is active and whether a panel is open,
and React Router does the matching and navigation, so there's no second copy of route state to keep in sync.

```sh
pnpm add @buildkitgg/react-router react-router react
```

```tsx
import { createRouterAdapter, useRoutePanel } from "@buildkitgg/react-router"
import { createBrowserRouter, RouterProvider } from "react-router"

const router = createBrowserRouter([{ path: "*", element: <PersonPanel /> }])
const adapter = createRouterAdapter(router)
const person = adapter.route({ to: "/people/42", match: "/people/:id" })
const people = adapter.route({ to: "/people", preserveSearch: true })

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

The adapter needs a data router, from `createBrowserRouter` or `createMemoryRouter`; declarative `<BrowserRouter>` isn't
one. Buildkit adds no provider of its own. Destinations resolve from the root and need concrete params. React Router's
`matchPath` matches route patterns, and a target matches its exact destination unless you pass `match`. Keeping the
current query string is opt-in: `preserveSearch` keeps it when `to` has no query of its own. Use React Router's `Link`
for ordinary links.

| Export                                                      | Behavior                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `createRouterAdapter(router)`                               | Connects a data router. Create one per router, or per request on the server.                 |
| `adapter.route({ to, match?, navigate?, preserveSearch? })` | Creates a route target. `navigate` takes React Router's navigate options, such as `replace`. |
| `useRouteTabs`, `useRoutePanel`                             | The hooks from [`@buildkitgg/react-routing`](../react-routing/README.md).                    |

See [route tabs and panels](../../../docs/routing.md) for defaults, SSR, history, matching, and integration details.
