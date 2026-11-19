# Shared application behavior

Buildkit puts reusable app behavior in framework-independent stores, adds React bindings where they're needed, and keeps
rendering in adapters for your component library. Factories replace process-wide mutable singletons, and an app can
export its own shared instance. Core contracts don't import ReactNode, Fluent props, browser globals, or a particular
router.

## Preferences and themes

- `@buildkitgg/preferences-core`: generic defaults and overrides, immutable snapshots, JSON import and export, optional
  local or session storage, and disposal. Its explicit `/browser` entry point also connects browser persistence.
- `@buildkitgg/react-preferences`: hooks for the whole store and for individual typed keys, with no provider.
- `@buildkitgg/theme-core`: keeps overrides in preferences-core, then adds declared themes, the light and dark pair that
  `"system"` follows, and validation. Its optional `/browser` entry point connects device settings and local storage,
  and, only when asked, binds a class or attribute on `<html>` or `<body>` to the store in both directions, with a
  matching first-paint script.
- `@buildkitgg/react-theme`: `useTheme(store)` through `useSyncExternalStore`, with no context provider.
- `@buildkitgg/shadcn-theme`: each theme's classes on the document, always bound in both directions, `color-scheme`,
  connection lifecycle, and a first-paint script.
- `@buildkitgg/fluentui-theme`: a Fluent theme per declared theme, native provider integration, the shared browser
  connection lifecycle, and an opt-in element binding for CSS-first code.
- `apps/behavior-storybook`: shadcn, Fluent UI, and preferences examples with persistence and portaled UI.

Theme storage uses the same JSON override object as preferences (`{"theme":"dark"}`, plus `systemLight` and `systemDark`
once the user changes the pair). The general preferences API can't infer enum constraints from types, so theme-core
checks stored values against the declared themes itself, and an invalid theme falls back to the app default when
resolving appearance. System is the default theme. An app can change the default, and a valid persisted user choice
takes precedence over it. Browser effects are explicit and disposable. Each package ships TypeScript declarations with
its compiled exports.

## Behavior extracted from Fluent UI packages

The existing Fluent UI packages below, in local repositories under `D:/msft`, set these boundaries: what moves into a
framework-independent core, and what stays in adapters. Form package names are provisional.

| Existing implementation                                                                                     | Extractable behavior                                                                                                                                              | Keep in adapters                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fluentui-modal-manager/src/ModalManager.tsx` and `ModalManager.types.ts`                                   | `modal-core`: stack snapshots, handles, duplicate-ID policy, updates, settlement, and open/closing lifecycle                                                      | React render callbacks and ReactNode content; Fluent DialogModalType and surface props; built-in confirm/alert bodies and animation completion                       |
| `fluentui-message-bar-manager/src/MessageBarManager.ts`                                                     | `alert-core`: region queues, IDs, replacement, handles, update/dismiss/flush semantics and notifications                                                          | ReactNode title/body/action labels and Fluent surfaces; shadcn Alert composition and dismissal controls                                                              |
| `fluentui-rhf-inputs/src/utils/getControlledComponentProps.ts` and controlled inputs                        | Form-library adapters for typed values, field state, validation, blur/ref/handler composition; extract only genuinely independent value transformations into core | RHF Controller, FieldPath and rules stay RHF-specific; Fluent FieldProps and `(event, data)` mapping stay Fluent-specific; shadcn controls get their own UI mappings |
| `fluentui-react-router/src/hooks/useRoutePanel.ts`, `useTabRoutes.ts`, and `prefetch/routePrefetchStore.ts` | Route destination/default policy and reusable prefetch caching where independent of router APIs                                                                   | React Router matching/navigation and route objects; Fluent event types and link shims; shadcn rendering and event signatures                                         |

## Status and remaining work

Modals, alerts, and routing are built:

- Modal lifecycles live in `modal-core`, `react-modals`, `shadcn-modals-manager`, and `fluentui-modals-manager`. See
  [modal architecture and lifecycle](modals.md) for the adapter contract.
- Alert packages use generic content, region-scoped subscriptions, immutable snapshots, replacement, and separate
  dismiss and flush semantics. Timed feedback uses native toast APIs. See [alert architecture](alerts.md).
- Route tabs and panels live in `router-core`, `react-routing`, `react-router`, and `tanstack-router`. They derive tab
  and panel state from the URL instead of keeping a second selection state, and keep the query-string policy, route
  exclusions, modified-click behavior, and direct-link dismissal destinations. React Router's matching stays in its
  adapter rather than in a reimplemented route parser, and prefetching is left to each router's native preloading. See
  [routing](routing.md).

Form bindings are the remaining work:

1. Split form bindings by field family. Preserve generics, refs, validation precedence, handler composition, and value
   shapes for text, checked values, arrays, dates, and time. Add TanStack Form bindings separately; don't treat RHF's
   `Controller` contract as a framework-agnostic core.
2. Add Fluent and shadcn form surfaces against those contracts.

The existing Fluent packages can delegate to the extracted contracts once compatibility and publishing decisions are
made. Reuse their behavioral tests to protect extraction semantics, but don't duplicate upstream UI-library suites.

Native Fluent, Base UI, and Sonner toast managers already provide queues, so there's no shared toast core; see
[the research and package decision](alerts.md).

Avoid a universal behavior package or a mandatory singleton. Split packages by domain, and don't publish empty
abstractions just to fill a package matrix. The Fluent theme adapter renders `FluentProvider` while the selection stays
in the core store.
