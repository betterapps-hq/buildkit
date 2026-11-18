# Public behavior APIs

These contracts keep reusable state apart from framework and UI integration, so the same store works in React, in plain
TypeScript, and behind each UI adapter. Package root exports include type declarations, and browser-only connections
have their own `/browser` entry points. Public APIs don't expose the internal preferences store that theme packages use.

| Package           | Consumer API                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| preferences-core  | `createPreferences<T>`, `get`, `set`, `reset`, `resetAll`, snapshots, subscriptions, JSON import/export, `dispose`             |
| react-preferences | `createPreferences<T>` from preferences-core, `usePreferences(store)`, `usePreference(store, key)`                             |
| theme-core        | `createThemeStore`, `setTheme`, `reset`, snapshots, subscriptions, `setSystemTheme` for environment adapters                   |
| react-theme       | `createThemeStore` from theme-core, `useTheme(store)` returning selection, resolved appearance, `setTheme`, and `reset`        |
| shadcn-theme      | `createShadcnTheme`, the theme store contract plus reference-counted `start`, `getThemeInitScript`, and `useTheme`             |
| fluentui-theme    | `createFluentTheme`, the theme store contract plus tokens and reference-counted `start`, `FluentThemeProvider`, and `useTheme` |

## Preferences

Infer key/value types from defaults or supply a generic for unions and keys without defaults. Defaults are partial;
reads can return undefined. Setters and reset accept only declared string keys. Reset removes an override rather than
recording a replacement. Values must be JSON-compatible; nested values are copied and frozen. Consumers replace values
through setters rather than mutating snapshots.

Storage is optional. Choosing localStorage or sessionStorage requires a nonempty key; a key without a storage mechanism
is rejected. Explicit browser connections return cleanup. Factory-owned connections are released by `dispose`.

JSON import is atomic and supports merge or replace. Exports contain overrides only. Generics are compile-time
contracts, not runtime schemas: imports check JSON compatibility and basic categories available from defaults, not
unions, unknown keys, or nested shapes. Import trusted configuration; domain adapters validate semantic values.

## Themes

Selection is `light | dark | system`; resolved appearance is `light | dark`. System is the default selection. Apps may
override `defaultTheme` and the initial `systemTheme`. Invalid initial themes and setter values throw. `reset()` clears
the persisted override and restores the configured default, including when the selected value already equals it.

Omit storageKey for memory-only selection. A storageKey enables localStorage by default; selecting sessionStorage also
requires a key. Browser effects belong to explicit connections or adapter `start()` calls. Fluent's provider manages
that connection automatically; it remains necessary for native Fluent styling and portals. UI dependencies are peers.

Create isolated stores per server request. Server snapshots retain the initial state; match initial server/client
configuration during hydration. Shadcn's first-paint script uses the same selection and storage options as its store.

Changes to released contracts require an appropriate Beachball change file and semantic version decision.

## Modals

See the [modal API and lifecycle guide](modals.md). `modal-core` owns stack state and results, and `react-modals` adds
typed content, subscriptions, and the renderer.

`shadcn-modals-manager` and `fluentui-modals-manager` both export `createModalManager`, `ModalRenderer`, `ModalManager`,
`ModalRendererProps`, and `ModalSurfaceOptions`, and their operations and types, including `ModalManagerOptions` and
`ModalAdapter`, are identical. Both renderers take only `manager`. `createModalManager({ labels?, adapter? })` binds the
adapter once. Without one, it uses the package's default components: the dialog from the app's generated
`@buildkitgg/shadcn`, or Fluent's `Dialog`. An explicit adapter always wins. `surfaceProps` holds the portable
`className` and `style` fields. shadcn registry components plug in through `adapter: baseUiComponents(...)` or
`adapter: radixComponents(...)`; there's no primitive prop or renderer factory. Application styles, UI providers, and
custom form controls stay with the application, and the UI adapters don't expose their internal core store.

Custom definitions use `createModal({ initialState, body, defaultResult, beforeDismiss? })`. State is inferred from
defaults; `open(overrides?)` and object/function updates remain typed. Custom updates use
`{ data: partialState, title?, description?, dismissible?, surfaceProps? }`; functional updaters receive presentation
and `current.data`. Results default to state plus `null`, with separate result types supported by annotated components
or generics. Core owns pending actions, errors and guarded dismissal; components own fields and validation. See
[form examples](modal-forms.md).

`title`, `body` and `footer` accept React nodes or live component slots. `onClose` observes typed results and close
reasons. See [slots and updates](modal-updates.md) for clearing, naming and adapter contracts.
