# @buildkitgg/preferences-core

Keep a user's choices, such as theme or page size, with typed keys, app defaults, optional local or session storage, and
JSON export for backups. No React or validation library dependency.

```sh
pnpm add @buildkitgg/preferences-core
```

```ts
import { createPreferences } from "@buildkitgg/preferences-core"

type AppPreferences = {
  theme: "system" | "light" | "dark"
  pageSize: number
}

export const preferences = createPreferences<AppPreferences>({
  defaults: { theme: "system" },
  storage: "localStorage",
  key: "my-app-preferences"
})

preferences.get("pageSize") // number | undefined; initially undefined
preferences.set("pageSize", 50)
preferences.reset("pageSize") // undefined again
```

Omit the type argument to infer keys and value types from `defaults`. Inferred types widen, so `25` becomes `number`,
not the literal `25`. Declare the type for string unions and for preferences without defaults. `get` returns
`T[K] | undefined` even when a default exists. `get`, `set`, and `reset` accept only declared string keys, and `set`
requires the matching value type. Symbol and numeric keys aren't supported.

## API

| Method                         | Behavior                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `get(key)` / `set(key, value)` | Read the effective value, or set a user override.                                                                                     |
| `reset(key)` / `resetAll()`    | Remove overrides, restoring the default or `undefined`.                                                                               |
| `getSnapshot()`                | Returns the effective values, frozen. The object stays the same until an override changes.                                            |
| `getServerSnapshot()`          | Returns the initial defaults, for SSR and hydration.                                                                                  |
| `subscribe(listener)`          | Calls `listener` after each committed change. Returns an unsubscribe function.                                                        |
| `exportJson()`                 | Returns a JSON string of the user's overrides only.                                                                                   |
| `importJson(json, { mode })`   | Merges (the default) or replaces overrides in one step, notifying once if anything changed.                                           |
| `dispose()`                    | Disconnects storage that `createPreferences` connected and removes subscribers. Reads still work; writes and new subscriptions throw. |

Defaults and values are copied and deeply frozen, so mutating an object you passed in can't change the store. Setting a
value equal to its default still records an override. Objects are replaced whole; there's no deep merge. To remove an
override, call `reset` instead of setting `undefined`.

## Persistence

Omit `storage` for memory-only state; passing a `key` without it throws. `"localStorage"` and `"sessionStorage"` need a
nonempty `key`. When a browser is available, the store connects to storage as soon as you create it, and valid saved
overrides win over defaults. Resetting every override removes the storage item. Blocked storage, a full quota, malformed
JSON, and detectable type mismatches never stop the store working in memory. An invalid saved payload is ignored whole,
never applied in part.

Local storage stays in sync across tabs of the same origin. Session storage survives reloads within a tab and stays
separate from other top-level tabs, though a browser may copy it into a tab opened from the current one. Native storage
events also sync frames within a tab. When another tab removes or clears the item, this store returns to its defaults,
and changes that arrive from another tab aren't written back.

The root entry point is safe to import without `window`. For user-specific SSR, create a store per request, and keep the
initial defaults identical on server and client. If your SSR framework needs browser setup deferred, create the store
without `storage` and call `connectPreferencesStorage(store, { storage, key })` from
`@buildkitgg/preferences-core/browser` in its client shell. Call the cleanup function it returns yourself, and don't
also pass `storage` to `createPreferences` for the same store.

## JSON and runtime limits

Export, import, and persistence share one format: a plain JSON object of overrides. Merging keeps overrides the import
doesn't mention; replacing drops them. A failed import throws without changing state, storage, or subscriptions. A
successful import saves once and notifies once. Defaults aren't exported, so an explicit choice stays a choice when
imported into another instance of the app.

Values must be finite numbers, strings, booleans, `null`, arrays, or plain objects. Dates, maps, functions, symbols,
`undefined`, cycles, and unsafe prototype keys are rejected before serialization. A value with a default gets a shallow
type check (number, string, boolean, array, or object) on `set` and on import. A `null` default doesn't reveal a type,
and nothing infers nested schemas or enum members.

TypeScript types aren't runtime schemas. Keys without defaults, unknown keys, array element types, and enum members
can't be validated from a type argument. Imported keys are kept even when unknown, because keys declared only in the
type must work, so an unknown key can reappear in the next export. Treat imported JSON as trusted configuration, not a
security boundary. Packages built on this one, such as `@buildkitgg/theme-core`, validate their own values, and the API
doesn't require Zod or another schema library.

See the [maintenance guide](docs/README.md).
