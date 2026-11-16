import { defineMain } from "@buildkitgg/storybook-config/main"
import react from "@vitejs/plugin-react"

export default defineMain({
  stories: ["../src/**/*.stories.tsx"],
  viteFinal: (config) => ({
    ...config,
    plugins: [...(config.plugins ?? []), react({ compiler: true })],
    // The shadcn managers import the app's generated `@buildkitgg/shadcn`. In this workspace they could find another
    // app's build, so Storybook's own is resolved for them too.
    resolve: { ...config.resolve, dedupe: [...(config.resolve?.dedupe ?? []), "@buildkitgg/shadcn"] }
  })
})
