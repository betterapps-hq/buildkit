# @buildkitgg/react-routing

React hooks for route tabs and panels, driven by the URL and bound to whatever tabs and drawers your component library
provides. The hooks work with any router through a small adapter, and need no context provider.

```sh
pnpm add @buildkitgg/react-routing react
```

Router adapters such as `@buildkitgg/react-router` and `@buildkitgg/tanstack-router` create the adapter and route
targets, and re-export these hooks.

```tsx
import { useRoutePanel, useRouteTabs, type RouterAdapter, type RouteTarget } from "@buildkitgg/react-routing"

type PeopleProps = { adapter: RouterAdapter; people: RouteTarget; person: RouteTarget }

export function People({ adapter, people, person }: PeopleProps) {
  const tabs = useRouteTabs(adapter, { tabs: [{ id: "people", route: people }] })
  const panel = useRoutePanel(adapter, { route: person, closeTo: people })

  return (
    <>
      <button aria-pressed={tabs.activeTab === "people"} onClick={() => void tabs.select("people")}>
        People
      </button>
      <dialog open={panel.isOpen}>
        <button onClick={() => void panel.close()}>Close</button>
      </dialog>
    </>
  )
}
```

| Export                            | Behavior                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `useRouteTabs(adapter, options)`  | Subscribes to the URL and returns `activeTab` and `select`.                              |
| `useRoutePanel(adapter, options)` | Subscribes to the URL and returns `isOpen`, `open`, `close`, and `setOpen`.              |
| `RouterAdapter`                   | The contract an adapter implements: `subscribe`, `getSnapshot`, and `getServerSnapshot`. |

The hooks use `useSyncExternalStore`, unsubscribe on unmount, and keep no local copy of URL state. The options and the
`RouteTarget` type come from [`@buildkitgg/router-core`](../../core/router-core/README.md). Create one adapter per
router, and one per request on the server.

See [route tabs and panels](../../../docs/routing.md) for defaults, SSR, history, matching, and integration details.
