import { catalogVersion } from "./version.js"

/** Pins for every package the generated apps depend on. Every version was on npm for at least a day on 2026-10-29. */
export const versions = {
  // The CLI and the catalog release together, so an app pins the CLI at the catalog's own version.
  "@buildkitgg/cli": catalogVersion,
  "@tanstack/react-router": "1.170.46",
  "@tanstack/react-start": "1.169.4",
  react: "19.3.1",
  "react-dom": "19.3.1",
  vite: "8.3.5",
  "@vitejs/plugin-react": "6.1.2",
  "oxc-transform-react": "0.155.0",
  typescript: "7.0.2",
  "@types/react": "19.3.0",
  "@types/react-dom": "19.3.0",
  "@types/node": "24.19.2",
  oxlint: "1.89.0",
  oxfmt: "0.74.0",
  "@lingui/core": "6.10.1",
  "@lingui/react": "6.10.1",
  "@lingui/cli": "6.10.1",
  "@lingui/vite-plugin": "6.10.1"
} satisfies Record<string, string>
