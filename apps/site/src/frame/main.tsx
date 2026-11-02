// The fake API is in place before any example loads, since some fetch as soon as their module runs
import "./server"
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import "@buildkitgg/shadcn-baseui-kit/styles.css"
import "./frame.css"
import { StrictMode, type ComponentType } from "react"
import { createRoot } from "react-dom/client"
import type { ExampleId } from "./bridge"

const EXAMPLES: Record<ExampleId, () => Promise<{ Example: ComponentType }>> = {
  modals: () => import("./modals"),
  preferences: () => import("./preferences"),
  alerts: () => import("./alerts"),
  routing: () => import("./routing"),
  configuration: () => import("./configuration")
}

function isExampleId(id: string | null): id is ExampleId {
  return id !== null && Object.hasOwn(EXAMPLES, id)
}

const id = new URLSearchParams(window.location.search).get("example")
const root = document.getElementById("root")
if (!root || !isExampleId(id)) {
  throw new Error(`Unknown example: ${id}`)
}
document.documentElement.dataset.example = id
const { Example } = await EXAMPLES[id]()
createRoot(root).render(
  <StrictMode>
    <Example />
  </StrictMode>
)
