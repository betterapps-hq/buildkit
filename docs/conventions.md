# Coding conventions

These conventions apply to all TypeScript and React code in the monorepo. Oxlint enforces many of them through the
shared rules in [`packages/tooling/oxlint-config/src/base.ts`](../packages/tooling/oxlint-config/src/base.ts). The
agent-facing summary in [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) links here through the
[docs index](README.md).

## Quality gates

- Run `pnpm verify` before finishing. It checks formatting, lint, types, unused code, API reports and coverage, then
  builds everything.
- New code ships with co-located tests and keeps the app or package's Vitest coverage thresholds green.
- Vite+ Git hooks lint and format staged files on commit and run `pnpm check` on push. Don't bypass them with
  `--no-verify`.

## TypeScript and type helpers

Read [typescript.md](typescript.md) before writing a new type helper. It covers type conventions (no `any`, avoiding
`as`, narrowing order, `type` versus `interface`, enums) and catalogs the helper libraries: `ts-extras`, `ts-pattern`,
`tiny-invariant` and `zod`.

## Hooks

Read [hooks.md](hooks.md) before writing a new hook. It covers hook conventions and catalogs `@mantine/hooks`.

## React

[react.md](react.md) covers component conventions (function declarations, no `React.FC`, prop type naming, the React
Compiler), choosing and styling a UI system per product surface, and the libraries for state, errors, URLs, routing and
forms.

## Imports and exports

- Prefer named exports, so a rename stays consistent everywhere.
- Avoid barrel files (an `index.ts` that only re-exports). The exception is a leaf folder re-exporting its own component
  or resource.
- Extend the shared configs from `@buildkitgg/oxlint-config`, `@buildkitgg/storybook-config` and
  `@buildkitgg/typescript-config` instead of redefining their rules in a package.
- Prefer path or package aliases over deep relative paths such as `../../../`.

## Logging

Product code doesn't call `console.log` or the other `console` methods; lint allows only `console.warn` and
`console.error`. Temporary local debugging is the exception.

## Tests

Test code is production code, so hold it to the same bar.

- Co-locate tests with the source: `*.test.tsx` for unit tests in happy-dom, and `*.stories.tsx` for stories, which
  `@storybook/addon-vitest` runs as browser tests on Playwright.
- Drive interactions with `@testing-library/user-event`, and query by role or text rather than implementation details.
- Mock as little as possible. Prefer integration-style tests that exercise real collaborators over fully mocked units.

<a id="files--component-layout"></a>

## Files and component layout

Split a component by concern so its `.tsx` file stays focused on rendering:

| File                          | Holds                                                                    |
| ----------------------------- | ------------------------------------------------------------------------ |
| `{ComponentName}.tsx`         | The component and its `{ComponentName}Props` type                        |
| `{ComponentName}.styles.ts`   | Griffel styles for Fluent components; omit when utility classes suffice  |
| `{ComponentName}.hooks.ts`    | Component-scoped hooks                                                   |
| `{ComponentName}.utils.ts`    | Non-render helpers and logic                                             |
| `{ComponentName}.test.tsx`    | Tests (`.tsx` when they render JSX, otherwise `{ComponentName}.test.ts`) |
| `{ComponentName}.stories.tsx` | Storybook stories                                                        |

- Name component files in PascalCase (`AppDrawer.tsx`) and everything else, such as utils, hooks and services, in
  camelCase (`toPixelDimension.ts`, `useDisclosure.ts`).
- Give a multi-file component its own folder, named after the component. A single-file component can stay a lone
  `{ComponentName}.tsx`.
- Keep the component name, file name and folder name in step: renaming the component renames its files and folder.
