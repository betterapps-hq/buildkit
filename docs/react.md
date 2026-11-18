# React

Conventions for writing React components in this monorepo. Hooks have their own page: see [hooks.md](hooks.md).

## Components

- Define components as function declarations, not arrow consts. Use an arrow only for a `forwardRef` wrapper, and never
  use `React.FC`.
- Name prop types `{ComponentName}Props` and keep them in the component's `.tsx` file.
- Omit explicit return types; let inference supply the render type.
- Turn on the React Compiler in React apps, and don't hand-write `useMemo`, `useCallback`, or `React.memo` for
  performance. Follow the Rules of React so the compiler can memoize safely.
- Name event handlers with an `on` prefix (`onClick`) or a `handle` prefix (`handleClick`).
- Wrap every app in `<StrictMode>` and a top-level `react-error-boundary`, plus the provider its UI system needs, such
  as `FluentProvider` for Fluent UI. Wrap stories and tests in the same shell so every surface shares context.
- Choose the UI system at the app or product-surface boundary. Apps and product surfaces can be designed around Fluent
  UI v9 or shadcn/ui. Keep one component system within a product surface unless an explicit integration requires
  otherwise.

## Styling

- Follow the selected UI system's styling model. Fluent surfaces use Griffel's `makeStyles()` and Fluent tokens.
  shadcn/ui surfaces use shadcn's CSS-variable tokens, with Tailwind CSS when the app runs shadcn-sync in Tailwind mode
  and plain CSS otherwise. Define shared visual values as tokens rather than scattering hard-coded colors or spacing,
  and apply the app's global reset and base styles once at its root.
- Put styles in `{ComponentName}.styles.ts` and export a hook named `use{ComponentName}Styles()`. Name its result
  `classes` at the call site.

## State, errors, and URL

- Wrap error-prone subtrees in [`react-error-boundary`](https://github.com/bvaughn/react-error-boundary).
- Read and write URL state with [`nuqs`](https://nuqs.dev) instead of parsing `location.search` by hand.
- Use [TanStack Router](https://tanstack.com/router) for type-safe routing. Register the router type and prefer the
  router's `<Link>`, which validates `to` and can preload on intent.
- Build forms with [TanStack Form](https://github.com/TanStack/form/tree/main/packages/react-form) and validate them
  with Zod schemas. On Fluent surfaces, use `form.Field` to bind the control's value and its change and blur handlers,
  and Fluent's `Field` for the label and validation message.
- Use the selected UI system's feedback and dialog primitives instead of building ad hoc global state for them. On
  Fluent surfaces, use Toasts for transient action feedback, Message Bars for persistent inline status, and Fluent
  `Dialog` for modals. Buildkit's [modal](modals.md) and [alert](alerts.md) managers render the dialogs and Message Bars
  for you.

For component file layout (`{ComponentName}.tsx`, `.styles.ts`, `.utils.ts`, `.test.tsx`, and `.stories.tsx`), see
[conventions.md](conventions.md#files--component-layout).
