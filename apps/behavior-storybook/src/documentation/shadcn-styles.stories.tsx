import type { Meta, StoryObj } from "@storybook/react-vite"
import { Code, Documentation } from "./Documentation.js"

const meta = {
  title: "shadcn/Style selection",
  parameters: { layout: "fullscreen", controls: { disable: true } }
} satisfies Meta

export default meta

export const Overview: StoryObj<typeof meta> = {
  render: () => (
    <Documentation
      title="Select a component style"
      summary="shadcn-sync builds stock shadcn components into a package in your app. Pick the primitives, style, theme and icons once; your imports and Buildkit's managers stay the same."
    >
      <p>
        For individual component usage, see the <a href="https://ui.shadcn.com/docs/components">shadcn documentation</a>
        .
      </p>
      <h2>Set up</h2>
      <p>
        Run the installer in your app&apos;s folder. It asks for each setting and adds a postinstall that runs sync.
      </p>
      <Code>{`pnpm dlx @buildkitgg/shadcn-sync`}</Code>
      <h2>Import from the generated package</h2>
      <Code>{`import { Button } from "@buildkitgg/shadcn"
import { createModalManager } from "@buildkitgg/shadcn-modals-manager"

export const modals = createModalManager()`}</Code>
      <p>
        Each component brings its own CSS, so there&apos;s no stylesheet to import. The managers render with the same
        generated package. They need no style prop or renderer adapter.
      </p>
      <h2>Change the style</h2>
      <Code>{`pnpm exec shadcn-sync set --style vega`}</Code>
      <p>
        Sync rebuilds the package and updates the postinstall to match. Imports stay unchanged. The style is chosen at
        build time; light and dark mode and brand colors still change through CSS variables.
      </p>
    </Documentation>
  )
}
