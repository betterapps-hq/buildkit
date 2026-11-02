import { createRouterAdapter } from "@buildkitgg/react-router"
import { createBrowserRouter } from "react-router"

export const router = createBrowserRouter([
  {
    lazy: () => import("./Workspace"),
    children: [
      { path: "/people/:personId?", lazy: () => import("./People") },
      { path: "/settings", element: <h2>Workspace settings</h2> }
    ]
  }
])

export const adapter = createRouterAdapter(router)

export const people = adapter.route({ to: "/people", match: { path: "/people", end: false } })
export const settings = adapter.route({ to: "/settings" })
