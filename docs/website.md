# Buildkit.gg website

The static landing page lives in `apps/site`. VitePress renders guides and API reference at `/docs/`; Storybook is
deployed at `/storybook/`. The landing page links each package to its guide in the reference docs. API Extractor
discovers typed exports; API Documenter renders their signatures and source comments. VitePress renders the generated
Markdown.

## Local development

Run `pnpm --filter @buildkitgg/site dev` and `pnpm --filter @buildkitgg/behavior-storybook storybook` in separate
terminals. For reference docs, run `pnpm check:api`, `pnpm --filter @buildkitgg/docs generate`, then
`pnpm --filter @buildkitgg/docs dev`. The landing page links to these local servers during development.

## GitHub Pages

The `Publish Buildkit website` workflow (`.github/workflows/pages.yml`) runs on every push to `main`. It runs
`pnpm verify`, which also builds Storybook, then builds the website and reference docs for the configured Pages URL,
copies Storybook and the docs into the site's `dist`, uploads it as one artifact, and deploys it through the
`github-pages` environment. Deployment uses GitHub's Pages OIDC token, without a personal access token. CI runs the same
API check (`pnpm check:api`), and a package release waits for CI to pass.

Before the first deployment, select **GitHub Actions** as the repository's Pages source. Configure **buildkit.gg** as
the custom domain in Pages settings, verify domain ownership, and apply the DNS records described in
[GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
Enable HTTPS once GitHub has issued the certificate. Custom-workflow deployments use the repository's domain setting; a
checked-in CNAME file does not configure it.

The workflow reads the configured Pages base path, so assets and Storybook links also work at the default `/buildkit/`
project URL. Canonical and social URLs target buildkit.gg. A local build never deploys or changes DNS.

## Documentation boundaries

Public API signatures and doc comments are extracted from compiled declarations. These models can feed a reference
renderer without maintaining signature lists by hand. Package guides are generated from package READMEs. Reference pages
and their search index are generated during the build and ignored by Git. Usage guides and examples still need authored
explanations. CLI commands must be documented from command metadata or `--help`, rather than inferred from TypeScript
exports. Storybook's dev-domains section explains the CLI and Node integration; it does not execute terminal commands in
a page.

The reference site groups router-core, react-routing, React Router, and TanStack Router under **Routing**. Each
integration keeps its guide and API reference together. The generated dev-domains CLI reference belongs to the
dev-domains package navigation. See the [reference site development guide](../apps/docs/README.md) for the shared
navigation definition.

## Domain and visual identity

GitHub Pages hosts the site, and Cloudflare manages DNS for `buildkit.gg`: the apex and `www` records point at GitHub
Pages as DNS-only records. To set the domain up again, configure the custom domain in GitHub first, then point the
records at GitHub Pages in Cloudflare. Keep them DNS-only during GitHub's domain and certificate verification, then
verify HTTPS and the canonical redirect. Use the Cloudflare `cf` CLI for DNS changes.

The marketing page has its own dark blue design, set in Geist and Geist Mono, with the Stack mark as its logo; the
reference site uses matching blue accents. The page is prerendered to static HTML, animated with GSAP, and keeps its
final state when reduced motion is requested.

The page's design lives in `design/buildkit.pen`, a [Pen](https://pen.dev) file with the desktop and phone layouts side
by side. Change the design there first, then match the page to it.

## Interactive examples

Each example on the page runs in its own frame, `apps/site/example.html`, so the styles of the site's generated shadcn
components, the preferences example's root font size and the routing example's router stay out of the page. The frame
runs the files in `apps/site/src/examples` on the real packages, and the editor beside it shows those same files, so the
code and the running example can't drift apart. The formatter skips that folder, since its files are wrapped to fit the
editor.

The frame code in `apps/site/src/frame` supplies what the examples assume: an `/api` that answers inside the frame (and
fails while the preview is offline) and the state each example's wire line reports. Three build changes in
`apps/site/vite.config.ts` keep that plumbing out of the code the editor shows. The routing example's
`createBrowserRouter` keeps its history in memory, so it never adds to the visitor's Back button. The modals example's
manager reports each `confirm()` to the wire line. The configuration example keeps its development-only overrides on in
the production build.
