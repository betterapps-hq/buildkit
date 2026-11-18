# Public API baselines

API Extractor writes a report for every typed `exports` entry of every `@buildkitgg/*` workspace package, unreleased
packages and secondary entry points included. CSS and other untyped assets are left out. The package list comes from the
workspace, not from a list kept by hand.

After reviewing an intentional API change, run `pnpm api:update` and commit the changed `.api.md` files with the code
and its Beachball change. `pnpm check:api` checks without accepting changes, and CI runs it in the job that builds the
docs. When an entry point is removed, its baseline stays until you delete it after review.

The reports show signature changes. They don't pick the semver release or catch behavior changes. API Extractor's
warnings about forgotten exports appear in the reports for review, and exports without doc comments show as
`(undocumented)` rather than failing the check. Release tags are optional. Internal declarations aren't made public just
to satisfy the tool.

Extraction also writes documentation models and an entry-point index to `dist/api-models`, one model per subpath. A
renderer must keep each package and subpath together rather than treating models that share a package name as separate
npm packages. The models are build artifacts; only the reports are checked in.
