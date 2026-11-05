# AGENTS.md

## Permission to change guidance

Treat repository rules, agent instructions, skills, and best practices as read-only unless the user explicitly
authorizes a concrete change. This covers this rule itself, every `AGENTS.md` and `CLAUDE.md`, instructions loaded
from other files, and everything in [best-practices/](best-practices/README.md). It applies to creating, editing,
formatting, moving, renaming, and deleting protected files, including changes made by tools or scripts.

When permission is needed, show the proposed changes in a table with **File**, **Before**, and **After** columns.
Give the exact affected wording or paths, with a row for each change. For additions or deletions, mark the absent
side as “absent.” Ask for approval of that table and wait before applying it. If the user has already explicitly
authorized the concrete change, apply only that change. A feature request, review, or failing check does not authorize
changing the rules.

## Repository instructions

- Start at the [best-practices index](best-practices/README.md). For every code change, apply the
  [coding principles](best-practices/principles.md) and [conventions](best-practices/conventions.md).
- Check the [preferred tech stack](best-practices/tech-stack.md) and discuss new libraries before adding them.
- Before adding a script to any `package.json`, get explicit user permission for the script name and command.
  If an existing script or a direct `vp` command covers the task, use it.

## Copy and UX

- Review every new or changed user-facing string with at least one writing skill before opening a PR. Use
  [writing-style-guide](.agents/skills/writing-style-guide/SKILL.md) for interface text, including labels, errors,
  empty states, and accessible names. Use [copy-editing](.agents/skills/copy-editing/SKILL.md) for marketing copy.
  Apply [brand-voice](.agents/skills/brand-voice/SKILL.md) when shaping the voice or
  [deslopify-writing](.agents/skills/deslopify-writing/SKILL.md) when checking for formulaic phrasing.
- Exercise changed user workflows in the running app with the integrated browser. Check desktop and mobile layouts,
  keyboard use, and accessible names.

## Documentation and data

- Update product documentation alongside behavior changes. Keep each page focused on one topic. Review prose, evidence
  ledgers, status tables, and narrative records directly. Reserve executable tests for code and generated artifacts
  that affect behavior, fabrication, or an external interface.
- Treat stale prototype data as disposable. Only migrate or repair it on explicit request. Preserve integration
  credentials and unrelated external configuration during a data reset unless the user explicitly requests a full reset.

## Before opening a PR

- When the change is ready for review, run the relevant focused checks, fix related failures together, and run
  `pnpm verify`.
- Only bypass a Git hook with explicit user permission for an unrelated failure. Run focused checks on the files
  being committed and report the blocker and checks in the handoff.

# Project-specific guidance

Project-specific requirements below take precedence over shared recommendations when they differ.

# Buildkit agent guidance

Read [.github/copilot-instructions.md](.github/copilot-instructions.md) before changes. Use pnpm 12 on Node 24+, Vite+
(`vp` for lint, format, type checks, tests and tasks), native TypeScript, and knip. Run `pnpm verify` before finishing;
never bypass Git hooks.

Put worktrees under `D:\system\worktrees\buildkit\<name>`. Remove worktrees and merged branches when done.

# Buildkit Monorepo — Project Guidelines

A Vite+ and pnpm monorepo with React 19 and TypeScript applications. UI systems are selected at the app or
product-surface boundary. Shared config lives in `@buildkitgg/*` packages under `packages/tooling/`. See
[README.md](README.md) for setup and the [docs index](docs/README.md) for conventions.

## Tooling (differs from common defaults)

- **Toolchain:** [Vite+](https://viteplus.dev) (`vp`). `vp lint` runs Oxlint (not eslint), `vp fmt` runs Oxfmt (not
  prettier), and `vp check` runs both plus type checks. Lint and format config lives in the root `vite.config.ts`.
- **Type-check:** `vp check` type-checks every workspace with the pinned native TypeScript; packages build with `tsc`.
  Keep the TypeScript version aligned across packages.
- **Test:** Vitest through `vp test`, importing from `vite-plus/test` (jsdom unit and Storybook browser tests).
  **Bundler/dev server:** Vite. **Workshop:** Storybook.
- **Package manager:** pnpm (`>=12`) on Node `>=24`, enforced via root `engines` + `engine-strict`.
- **Task runner:** `vp run`, which runs workspace scripts in dependency order and caches them with `--cache`.

## Build / verify loop

Complete the coherent implementation before running unit tests, type-checks, lint, browser acceptance, or the full
verification suite. Do not run these checks after each small edit. Once the implementation is complete, run the smallest
relevant focused checks, then run the required final verification. If a check exposes related defects, batch the repairs
before rerunning that check.

Run `pnpm verify` before declaring work done. It checks format, lint, types, unused code, test coverage, and builds.

Git hooks (Vite+, in `.vite-hooks/`): **pre-commit** runs `vp staged`, which lints and formats staged files;
**pre-push** runs `pnpm check`. Do not bypass them with `--no-verify`.

## Workspace layout

- `apps/` — documentation, examples, and test applications.
- `packages/` — reusable `@buildkitgg/*` libraries and shared configs.
- **Reusable shared config** (extend these; don't redefine per package): `@buildkitgg/oxlint-config`,
  `@buildkitgg/storybook-config`, `@buildkitgg/typescript-config`.

## Conventions

Coding conventions live in the [`docs/`](docs/README.md) folder — start at the index and read the relevant page before
writing code. Two points worth stating up front: enable the **React Compiler in React apps** (don't hand-write
`useMemo`/`useCallback`/`memo`), and **reuse before building** — check the [hooks](docs/hooks.md) and
[type-helper](docs/typescript.md) catalogs before writing your own.

Prefer the tools in the [preferred tech stack](docs/tech-stack.md); **introducing a library that isn't already used
needs a human discussion**, not a silent add.

## Documentation

- Document only current behavior. Do not add migration guides or comparisons with earlier implementations.
- **Keep this file brief** — it's the entry point; link to `docs/` articles rather than duplicating detail.
- **Prefer small, focused `docs/` pages**, and update them (and the [index](docs/README.md)) in the same change as the
  behavior they describe.
- Do not create executable validators or test suites for prose documentation, evidence ledgers, backlog/status tables,
  or narrative part-selection records. Review those artifacts directly. Tests should cover executable code and generated
  product artifacts whose correctness affects runtime behavior, fabrication, or an external interface.

## Product copy and UX acceptance

- Never use a dot glyph, including `·` or `•`, as a visual separator. Use layout, separate text elements, or a clearly
  worded phrase instead.
- Verify every new or changed UX feature in the integrated browser before considering it complete. Exercise the customer
  workflow, inspect the rendered result at desktop and mobile sizes, and check keyboard and accessible-name behavior.
  Unit or component tests do not replace this browser acceptance check.

## Gotchas

- Hosted on **GitHub** — use GitHub for PRs and issues.
- oxlint rules live in the shared `@buildkitgg/oxlint-config` base; add new rules there so every package benefits.

## Principles for development

- **Don't reinvent wheels.** [typescript.md](docs/typescript.md) and [hooks.md](docs/hooks.md) catalog what the
  installed libraries already provide. Check them before adding a hook or type helper.
- **One topic per page, kept short.** Prefer a new focused page over growing an existing one past a scannable length.
- **Docs stay current.** When behavior, tooling, or conventions change, update the relevant page (and this index) in the
  same change.
- Don't overtest or verify. Complete shippable units of work before running test passes and resolving failures. Test
  passes cost lots of time.
- Prefer correctness over expediency or backwards compatibility. If faced with an issue where the new behavior would
  create a breaking change, ask first whether it needs to be backwards compatible. If no user is available to answer,
  assume not.
- Unreleased packages may change directly. Released public packages require explicit compatibility and semver decisions.
- Do not create version-suffixed files, symbols, schemas, routes, or APIs such as `V2`, `Phase2`, `legacy`, or
  compatibility aliases. Keep one canonical implementation.
- Fix forward. Update the current implementation and its original migration baseline instead of adding compatibility
  migrations, data rewrites, shims, fallbacks, or dual paths for unreleased behavior.
- Prioritize correctness over expediency. Fix root causes and maintain coherent contracts even when resetting prototype
  state is faster than preserving it.
- Complete the entire coherent deliverable before running tests, type-checks, lint, formatting checks, browser
  acceptance, or repository verification.
- After the deliverable is complete, run the smallest relevant focused checks, repair related failures in one batch, and
  then run the required final repository verification.
- Do not run verification after each incremental edit or partial implementation.

Reusable packages are grouped under `packages/core`, `packages/react`, `packages/shadcn`, and `packages/fluentui`.
Shared configuration and developer tools live under `packages/tooling`. Package names and imports do not depend on their
directory.
