# Buildkit.gg

React marketing page for GitHub Pages, built with Vite, the React Compiler, and TypeScript. Run
`pnpm --filter @buildkitgg/site dev` and open the printed URL. Storybook and docs links use the local servers during
development (`pnpm --filter @buildkitgg/behavior-storybook storybook` and `pnpm --filter @buildkitgg/docs dev`).

The design was made in Pen.dev. Each section in `src/sections` matches its desktop frame at 1440px and its phone frame
at 390px, with its own stylesheet beside the component. `src/styles.css` holds the design tokens, base styles, and the
shared section, button, command, and code styles.

## Rendering

The production build prerenders the page to static HTML, then hydrates it for the interactive parts: the theme picker in
the hero, the architecture switches, the text size control, the style picker, copy buttons, and the mobile menu. Every
link and all copy work without JavaScript.

Geist and Geist Mono are bundled from `@fontsource-variable`, so the page loads nothing from third-party hosts.

## Motion

`src/motion` builds every GSAP timeline inside `gsap.matchMedia()`. When reduced motion is requested, the page keeps its
final state with no scrubs, pins, or 3D. An inline script in `index.html` marks the page for motion before it paints,
and elements marked `data-intro` fade in on their own if the motion module never starts. Mark elements that should rise
in on scroll with `data-reveal`, or a container whose children rise in sequence with `data-reveal-stagger`. Scenes for
single sections, such as the pinned architecture stack and the typing search palette, select that section's class names,
so rename those classes in `src/motion` too. In development, `?static` skips motion and renders the final state.

The hero and closing call to action share a WebGL background (`src/components/HeroField.tsx`), which lights a target
element from behind. It pauses off screen, holds one frame for reduced motion, and leaves the CSS gradient in place when
WebGL is unavailable.

## Deployment

The production build first bundles the browser app, then renders the same `Page` component through a temporary server
bundle in `.generated/server`. Only `dist` is deployed; GitHub Pages needs no Node server.

`PAGES_BASE` defaults to `/` for buildkit.gg and can be set to `/buildkit/` for the repository's default Pages URL.
Production Storybook files must be copied into `dist/storybook` and reference docs into `dist/docs` before uploading the
Pages artifact. The Pages workflow does this after both builds succeed. See [website operations](../../docs/website.md).
