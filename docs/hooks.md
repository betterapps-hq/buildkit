# React hooks

Reach for an existing hook before you write your own. This page covers hook conventions and catalogs
[`@mantine/hooks`](https://mantine.dev/hooks/use-disclosure/); the Mantine docs have each hook's exact signature and
options.

## Conventions

- Check the catalog below before writing a hook, and write a custom one only when nothing here fits.
- Put one hook in each file, named `use{Name}.ts`, next to its feature or in a shared `hooks/` folder.
- Turn on the React Compiler in React apps, and don't hand-write `useMemo`, `useCallback`, or `React.memo` for
  performance. Follow the Rules of React.
- Follow the Rules of Hooks: call hooks unconditionally, at the top level. Oxlint's `react/rules-of-hooks` rule enforces
  this.

## `@mantine/hooks` catalog

Hook names follow Mantine 9.6.0.

### State

- `useCounter` — integer counter with `increment`/`decrement`/`set`/`reset`.
- `useToggle` — cycle through a list of values (boolean by default).
- `useDisclosure` — boolean with `{ open, close, toggle }` handlers (modals, drawers, popovers).
- `useSetState` — partial state merges, like class `setState`.
- `useInputState` — state helper for controlled inputs (accepts an event or a value).
- `useListState` — array state with `append`/`prepend`/`insert`/`remove`/`reorder`/`setItem`/`apply`.
- `useMap` / `useSet` — reactive `Map` / `Set` that re-render on mutation.
- `useQueue` — keep a limited number of items active and queue the rest until space opens.
- `useStateHistory` — value with `back`/`forward`/`reset` history (undo/redo).
- `useValidatedState` — value plus its validation state.
- `useUncontrolled` — manage a component that can be controlled or uncontrolled.
- `usePagination` — pagination model: `active`, `range`, `next`, `previous`, `setPage`.
- `useSelection` — multi-select list state (select/deselect/toggle/all).
- `useForceUpdate` — return a function that forces a re-render.

### Timing — debounce / throttle / intervals

- `useDebouncedValue` — debounced copy of a changing value.
- `useDebouncedState` — state whose updates are debounced.
- `useDebouncedCallback` — a debounced callback.
- `useThrottledValue` / `useThrottledState` / `useThrottledCallback` — throttled equivalents.
- `useInterval` — managed `setInterval` with `start`/`stop`/`toggle`.
- `useTimeout` — managed `setTimeout` with `start`/`clear`.

### Storage & URL

- `useLocalStorage` — state synced to `localStorage` (and across tabs).
- `useSessionStorage` — state synced to `sessionStorage`.
- `useHash` — state synced to the URL hash.

### Lifecycle & refs

- `useDidUpdate` — effect that skips the first render.
- `useShallowEffect` — effect with shallow dependency comparison.
- `useIsomorphicEffect` — `useLayoutEffect` on the client, `useEffect` on the server.
- `useMounted` — boolean: has the component mounted.
- `useIsFirstRender` — boolean: is this the first render.
- `usePrevious` — the previous value of a variable.
- `useMergedRef` — merge multiple refs into one callback ref.
- `useLogger` — log a component's lifecycle and props (debugging).

### DOM interaction

- `useClickOutside` — detect clicks/taps outside a ref (dismiss menus/modals).
- `useHover` — `{ ref, hovered }` for hover state.
- `useFocusWithin` — boolean: focus is within the subtree.
- `useFocusTrap` — trap keyboard focus inside an element (modals).
- `useFocusReturn` — return focus to the trigger after an overlay closes.
- `useEventListener` — attach an event listener to an element via ref.
- `useWindowEvent` — attach a `window` event listener for the component's lifetime.
- `useMove` — track pointer movement over an element (sliders, color pickers).
- `useDrag` — drag interactions with position state.
- `useRadialMove` — angular/radial movement (dials, knobs).
- `useLongPress` — long-press gesture handler.
- `useResizeObserver` — observe an element's size via `ResizeObserver`.
- `useMutationObserver` — observe DOM mutations on an element.
- `useIntersection` — `IntersectionObserver` for an element (lazy loading, reveal).
- `useInViewport` — simple "is this element in the viewport" boolean.
- `useScrollIntoView` — animated scroll of an element into view.
- `useRovingIndex` — roving `tabindex` keyboard navigation for a group.
- `useSplitter` — resizable split-pane sizing.

### Scroll, viewport & window

- `useViewportSize` — reactive window `{ width, height }`.
- `useWindowScroll` — scroll position + `scrollTo`.
- `useScrollDirection` — current scroll direction (up/down).
- `useScrollSpy` — the active section based on scroll position.
- `useHeadroom` — show/hide a sticky header based on scroll direction.
- `usePageLeave` — callback when the pointer leaves the document.
- `useMouse` — pointer coordinates relative to the attached element.
- `useMousePosition` — mouse coordinates across the document.
- `useTextSelection` — the current `Selection` on the page.

### Environment & device

- `useMediaQuery` — subscribe to a CSS media query.
- `useColorScheme` — the system light/dark preference.
- `useReducedMotion` — `prefers-reduced-motion` boolean.
- `useOrientation` — device/screen orientation.
- `useOs` — detected operating system.
- `useNetwork` — online status + connection info.
- `useDocumentVisibility` — whether the tab is visible.
- `useDocumentTitle` — set `document.title`.
- `useFavicon` — set the page favicon.
- `useIdle` — boolean: user has been idle past a timeout.
- `useFullscreenDocument` / `useFullscreenElement` — toggle fullscreen for the document, or for the element attached to
  the returned ref.
- `useEyeDropper` — the browser EyeDropper API.
- `useFileDialog` — open a file picker without an `<input>`.
- `useClipboard` — `copy(value)` + `copied` state.
- `useFetch` — minimal fetch wrapper with `loading`/`error`/`data`.
- `useMask` — masked input formatting.

### Utilities

- `useId` — a stable unique id (SSR-safe).
- `useHotkeys` — register global keyboard shortcuts.
- `useCollapse` — animated height collapse/expand.
- `useFloatingWindow` — make an element draggable, optionally constrained to the viewport.

The [Mantine hooks docs](https://mantine.dev/hooks/use-disclosure/) list the hooks this page leaves out, with exact
options and return shapes.
