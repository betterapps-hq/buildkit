# Releases

Beachball manages independent package versions and changelogs. Run `pnpm change` with public package changes and commit
the generated change file. Pull request CI checks release notes and runs `pnpm validate`.

## Release from main

There are no release pull requests. Once CI passes on a push to main, its `release` job calls the shared
`beachball-publish-npm` template from [betterapps-hq/pipelines](https://github.com/betterapps-hq/pipelines):

1. It runs only for the commit at main's head. If main has moved on, the newer commit's own run releases it.
2. With no change files, it releases nothing.
3. Otherwise `pnpm build:packages` builds the packages and `beachball publish` bumps the versions and changelogs,
   publishes the new versions to npm in dependency order with provenance, then commits
   `chore(release): publish packages`, tags each version and pushes to main. That push runs CI again, which finds no
   change files.

The weekly shadcn pipeline regenerates the styles, checks the public APIs without accepting new baselines, writes patch
change files and validates. Then it commits straight to main, and main's CI releases the patches. A failed update pushes
nothing and uploads its diagnostics.

Only public `@buildkitgg/*` packages publish. Private packages remain incubating.

Beachball publishes with npm, so it rewrites `workspace:` ranges itself. Its patch in `patches/beachball.patch` teaches
it the aliased form the shadcn packages use, so `workspace:@buildkitgg/shadcn-baseui-nova@*` publishes as
`npm:@buildkitgg/shadcn-baseui-nova@<version>`, as pnpm would. Drop the patch once Beachball handles aliases itself.

If a release fails before publishing, nothing is pushed and main keeps its change files: rerun the failed `release` job
while that commit is still main's head, or let the next push's run release them. To publish versions that are on main
but not on npm, run **CI** by hand on main: its `publish-missing` job publishes every public version npm doesn't have,
in dependency order. Never bump versions by hand to retry a failed upload.

## Repository setup

- **Deploy key:** main is in a ruleset that requires pull requests and the CI checks, with deploy keys on its bypass
  list. A deploy key with write access is the only actor that pushes to main directly. Its private key is the `npm`
  environment's `RELEASE_DEPLOY_KEY` secret.
- **The `npm` environment** restricts deployments to `main`, without required reviewers or approval gates.

## npm setup

Configure each existing npm package's trusted publisher with owner `betterapps-hq`, repository `buildkit`, workflow
`ci.yml`, and environment `npm`. No npm token is stored in GitHub. The workflow uses GitHub's OIDC identity.

New packages require an initial authenticated publication before npm allows trusted-publisher configuration. Review the
API and packed consumer first, remove `private` in a reviewed change, and perform that initial release using npm's
interactive authentication. Then configure its trusted publisher and complete a CI publication within npm's activation
window. Do not remove `private` merely to test the workflow. See the
[npm trust command](https://docs.npmjs.com/cli/v11/commands/npm-trust/) for authenticated setup. Use npm 12 and specify
`--allow-publish` when creating the trust configuration. After the initial authenticated publication, merge a patch
change file so CI publishes a new version and validates the trust before it expires.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for account setup and troubleshooting.
