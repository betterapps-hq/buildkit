// Vite types the stylesheet imports. Referenced here too, so checking this file on its own finds them.
/// <reference types="vite/client" />
import { TooltipProvider } from "@buildkitgg/shadcn"
import { ExampleFrame } from "@buildkitgg/storybook-config/examples"
import { definePreview } from "@buildkitgg/storybook-config/preview"
import { StrictMode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import "../src/styles.css"

export default definePreview({
  parameters: {
    layout: "fullscreen",
    options: {
      storySort: {
        order: [
          "Getting started",
          ["Welcome", "Architecture"],
          "Core",
          ["*", ["Overview", "*"]],
          "React",
          ["*", ["Overview", "*"]],
          "shadcn",
          ["*", ["Overview", "*"]],
          "Fluent UI",
          ["*", ["Overview", "*"]],
          "Routing",
          ["Core", "React bindings", "React Router", "TanStack Router"],
          "Tooling",
          ["*", ["Overview", "*"]]
        ],
        method: "alphabetical",
        includeNames: true
      }
    }
  },
  decorators: [
    (Story, context) => (
      <StrictMode>
        <ErrorBoundary key={context.id} fallback={<p role="alert">This example could not render.</p>}>
          <TooltipProvider>
            {context.parameters.buildkitDocumentation ||
            context.name === "Overview" ||
            context.title === "Getting started" ? (
              <Story />
            ) : (
              <ExampleFrame
                group={context.title}
                title={context.name}
                description={context.parameters.docs?.description?.story}
                code={context.parameters.docs?.source?.code}
                catalog={context.parameters.buildkitCatalog}
              >
                <Story />
              </ExampleFrame>
            )}
          </TooltipProvider>
        </ErrorBoundary>
      </StrictMode>
    )
  ]
})
