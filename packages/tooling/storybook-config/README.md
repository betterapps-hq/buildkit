# @buildkitgg/storybook-config

Shared Storybook configuration for React and Vite: a base `main` config with the accessibility and Vitest addons, a base
preview, and frames that give example stories a consistent layout.

```sh
pnpm add -D @buildkitgg/storybook-config storybook @storybook/react-vite
```

## Main config

`defineMain` merges your config onto the base. Arrays such as `addons` are concatenated and objects are merged deeply,
so add only what your Storybook needs:

```ts
// .storybook/main.ts
import { defineMain } from "@buildkitgg/storybook-config/main"

export default defineMain({
  stories: ["../src/**/*.stories.tsx"]
})
```

The base uses the `@storybook/react-vite` framework, adds `@storybook/addon-a11y` and `@storybook/addon-vitest`, and
turns off telemetry. The framework and addons are dependencies of this package and are named by path, so your app
doesn't need to install them. Add app-specific addons, such as Chromatic's, under `addons` yourself.

Run the Vitest addon's story tests in CI only. They're too slow to run on every local test pass, so keep them out of the
test project your app runs locally.

## Preview

`definePreview` merges your annotations onto the base preview, which matches `color` and `date` controls by argument
name. Decorators are concatenated and parameters merged deeply:

```tsx
// .storybook/preview.tsx
import { definePreview } from "@buildkitgg/storybook-config/preview"

export default definePreview({
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <Story />]
})
```

## Example frames

`ExampleFrame` wraps a story in a heading, an optional description and an optional source disclosure. `ExampleResult`
labels the outcome of an action next to it:

```tsx
import { ExampleFrame, ExampleResult } from "@buildkitgg/storybook-config/examples"

export const Saved = () => (
  <ExampleFrame group="Forms" title="Save" description="Shows the saved state after submitting.">
    <button type="submit">Save</button>
    <ExampleResult>Saved</ExampleResult>
  </ExampleFrame>
)
```

Importing `@buildkitgg/storybook-config/examples` also loads the frames' stylesheet.
