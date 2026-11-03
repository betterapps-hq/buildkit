import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import "./styles.css"
import { createRoot, hydrateRoot } from "react-dom/client"
import { Page } from "./Page"

const root = document.getElementById("root")

if (!root) {
  throw new Error("The page root is missing")
}

if (root.querySelector("main")) {
  hydrateRoot(root, <Page />, { identifierPrefix: "buildkit-" })
} else {
  createRoot(root, { identifierPrefix: "buildkit-" }).render(<Page />)
}
