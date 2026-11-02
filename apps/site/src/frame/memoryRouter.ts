/**
 * `react-router` as the routing example's router.ts sees it in the frame. Its `createBrowserRouter` keeps history in
 * memory, so moving around the example never adds entries to the visitor's own Back button. The frame's address bar,
 * Back, Forward and Reload stand in for the browser's, and Reload passes the current path back in as `?path=`.
 */
import { createMemoryRouter } from "react-router"

export * from "react-router"

export function createBrowserRouter(...[routes, options]: Parameters<typeof createMemoryRouter>) {
  const path = new URLSearchParams(window.location.search).get("path") ?? "/people"
  return createMemoryRouter(routes, { ...options, initialEntries: [path] })
}
