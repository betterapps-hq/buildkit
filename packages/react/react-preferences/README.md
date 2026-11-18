# @buildkitgg/react-preferences

React hooks for [`@buildkitgg/preferences-core`](../../core/preferences-core/README.md): read and set typed user
preferences in components, without a context provider.

```sh
pnpm add @buildkitgg/react-preferences react
```

```tsx
import { createPreferences, usePreference } from "@buildkitgg/react-preferences"

const preferences = createPreferences<{ pageSize: number }>({ storage: "localStorage", key: "my-app" })

export function PageSize() {
  const [pageSize, setPageSize] = usePreference(preferences, "pageSize")
  return <button onClick={() => setPageSize(50)}>{pageSize ?? "Not set"}</button>
}
```

`createPreferences` is re-exported from `@buildkitgg/preferences-core`, so a React app imports from one package.
`usePreference(store, key)` returns a readonly tuple of the value (`T[K] | undefined`) and a typed setter.
`usePreferences(store)` returns the whole readonly snapshot. Both infer keys and values from the store and use
`useSyncExternalStore`. `usePreference` subscribes to the whole snapshot, so changing any preference rerenders its
component.

Create stores outside render, one per application or SSR request, and dispose them after their consumers unmount. Code
outside React uses the same store directly. Server rendering uses the snapshot from construction, so keep server and
client defaults identical, and decide in your framework's shell when to connect storage.

See the [maintenance guide](docs/README.md).
