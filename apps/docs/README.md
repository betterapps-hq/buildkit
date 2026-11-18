# Reference documentation

This app builds the reference site served at `/docs/`: a guide for each package, rendered from its README, and an API
reference generated from its typed exports. API Extractor produces the API models, API Documenter renders them to
Markdown, and VitePress builds the site.

From the repository root, run `pnpm check:api`, `pnpm --filter @buildkitgg/docs generate`, then
`pnpm --filter @buildkitgg/docs dev`. Open `/docs/` at the printed server address.
`pnpm --filter @buildkitgg/docs build` generates content and builds the site, and root `pnpm verify` runs extraction
before the build.

## What gets published

`scripts/generate.ts` writes a guide for every `@buildkitgg/*` package under `packages/`, skipping private repository
tooling that has no exports. Relative links in a README become links to the file on GitHub. The root README, `docs/` and
app READMEs aren't published. Guides and references are generated and ignored by Git, so edit package READMEs and TSDoc
comments instead. `content/index.md`, `content/routing/index.md` and the theme configuration in `content/.vitepress` are
authored. VitePress compiles Markdown as Vue, so put placeholders such as `<name>` in backticks; a bare one breaks the
build.

Generation runs the API Documenter CLI separately for each typed entry point, so each keeps its package and subpath
identity instead of being treated as its own npm package. Generated navigation links the entry points to each other;
links between symbols stay within one entry. Local full-text search is built in.

The dev-domains CLI reference lives within that package's navigation and is linked from its guide. It reads the compiled
command definitions without running commands or importing the CLI entry point.

## Navigation

`navigation.ts` owns the documentation grouping for the sidebar and the generated guide and API indexes. Routing groups
Core, React bindings, React Router and TanStack Router together; package names and architectural layers stay as they
are.

## Deployment

The Pages workflow publishes `dist/site` under `/docs/`, beside the landing page and Storybook. Set `PAGES_BASE` to the
deployment base path for project Pages hosting. VitePress and Microsoft's tools are development dependencies only.
