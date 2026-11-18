# @buildkitgg/dev-domains

Stable local URLs for your app, Storybook, and end-to-end test servers, across repositories and Git worktrees.

`@buildkitgg/dev-domains` gives each server a predictable hostname and runs it through
[Portless](https://github.com/vercel-labs/portless). You can open `https://shop.localhost` in your primary checkout and
`https://shop-fix-login.localhost` in a worktree, with ports assigned automatically. A configuration file lets you
choose your own names, use a real domain, list authentication callback URLs, and expose selected webhook routes.

Requires Node.js 24 or later. Supports Windows, macOS, and Linux.

## Table of contents

- [Motivation and philosophy](#motivation-and-philosophy)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Guided setup](#guided-setup)
- [Zero-configuration behavior](#zero-configuration-behavior)
- [Domain naming](#domain-naming)
- [Domain normalization and collisions](#domain-normalization-and-collisions)
- [Configuration files](#configuration-files)
- [Configuration schema](#configuration-schema)
- [Templates and environment variables](#templates-and-environment-variables)
- [Server commands and frameworks](#server-commands-and-frameworks)
- [Playwright](#playwright)
- [Node.js tooling](#nodejs-tooling)
- [Authentication callbacks](#authentication-callbacks)
- [Webhook tunnels](#webhook-tunnels)
- [Sharing a proxy across projects](#sharing-a-proxy-across-projects)
- [CI usage](#ci-usage)
- [Command reference](#command-reference)
- [Troubleshooting](#troubleshooting)

## Motivation and philosophy

Running several apps or worktrees often means competing for ports, updating bookmarks, and keeping callback URLs in
sync. An app might start on port 3000 today and 3001 tomorrow. Storybook and test servers add more addresses to track,
and several developers or coding agents working on the same machine make those conflicts more frequent.

`@buildkitgg/dev-domains` keeps the browser-facing address separate from the server's port. An **endpoint** is one
server process, such as a web app, API, or Storybook, paired with a hostname and the command that starts it. Multiple
routes served by the same process share that endpoint.

The package follows a few principles:

- Conventional setups work without a config file. Save a typed configuration when your project needs different names or
  commands.
- Linked worktrees are named after their folders. The primary checkout gets no `main` label, and hostnames never carry
  random hashes.
- [Portless](https://github.com/vercel-labs/portless) provides local routing and HTTPS. This package adds tool
  detection, typed configuration, and consistent domains across apps and worktrees.
- A running endpoint keeps its hostname. Another process that wants the same name gets an error and must choose a
  different one; it never takes over the route.
- Authentication providers, cloud resources, DNS administration, and deployment stay under your control. You don't need
  a Buildkit account or hosted service.

Separate hostnames and ports do not isolate databases, storage, credentials, or framework build directories. This
package manages local server addresses and processes; resource isolation remains part of your application setup.

## Installation

Install the package from npm as a development dependency in your project:

```sh
npm install --save-dev @buildkitgg/dev-domains
```

Install where the configuration and CLI are used. A root `dev-domains.config.ts` must be able to import the package from
the root; installing it only in `apps/web` may not satisfy that import. A workspace that imports the Playwright helper
or owns its own typed configuration must also be able to resolve the package. Declare a dependency in that workspace
when your package manager isolates workspace dependencies.

The commands in this guide use `npx @buildkitgg/dev-domains`, which runs the locally installed CLI. Installing and
locking the dependency keeps the CLI and configuration helpers on the same version. Portless is a dependency of this
package, so you don't install it separately. Your application frameworks and any tunnel executable must already be
installed.

On Windows, Portless also requires OpenSSL on `PATH`. Initial HTTPS setup can require permission to trust a local
certificate authority, bind the proxy port, or update the hosts file. Run setup interactively on each development
machine.

## Quick start

Start in the project you want to run. These commands inspect the detected servers and URLs, prepare the proxy, and start
one server:

```sh
npx @buildkitgg/dev-domains detect
npx @buildkitgg/dev-domains urls
npx @buildkitgg/dev-domains setup
npx @buildkitgg/dev-domains run
```

For a root package named `shop` with a `"dev": "vite"` script, the detected endpoint is `app`, at
`https://shop.localhost`. Run it directly with:

```sh
npx @buildkitgg/dev-domains run app
```

Open the URL printed by the CLI. A linked worktree folder named `fix-login` uses `https://shop-fix-login.localhost`. The
checked-out branch does not change either name.

`detect` and `urls` do not start servers or write configuration. With several endpoints, `run` displays a picker in an
interactive terminal. In automation, pass the endpoint name explicitly. Each invocation starts one endpoint; use
separate terminals or your existing task runner for additional servers.

Press Ctrl+C to stop the server and remove its owned routes. The shared proxy remains available for other servers.

## Guided setup

Run the wizard when you want to choose and save your endpoints:

```sh
npx @buildkitgg/dev-domains init
```

The wizard walks through these steps:

1. Confirm the project name and the local domain suffix.
2. Select which detected servers get domains. Detected E2E servers start unchecked. If nothing is detected, enter a
   server command as a JSON argument array instead.
3. Set the primary-checkout and worktree name templates for each endpoint.
4. For each app endpoint, optionally add authentication callback paths, a dedicated Playwright server, or a webhook
   tunnel.
5. Review the resulting domains and save `dev-domains.json` at the checkout root.

Use arrow keys to move, Space to toggle a selection, and Enter to continue. Ctrl+C cancels, and cancelling writes
nothing. If the checkout root already has a dev-domains config, `init` stops without changing it. It never rewrites
package scripts.

For noninteractive setup:

```sh
npx @buildkitgg/dev-domains init --yes --dry-run
npx @buildkitgg/dev-domains init --yes --project shop --domain localhost
```

`--yes` accepts detected ordinary servers and omits optional E2E servers. Without a terminal, `init` requires `--yes`.
`--dry-run` prints the proposed configuration without saving it. Without `--yes`, a dry run still uses the interactive
wizard. `--domain` changes the suffix; custom hostname layouts also require the name templates described under
[Domain naming](#domain-naming).

## Zero-configuration behavior

When no configuration file is found, these conventions determine the candidates:

| Concern                | Behavior                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project root           | The current Git checkout root; outside Git, the current directory or `--cwd`                                                                                             |
| Project name           | Root `package.json` name, otherwise the root folder name, normalized as described below                                                                                  |
| Package manager        | Root `packageManager`, then `devEngines.packageManager`, then lockfiles, then installation metadata; npm if none is found                                                |
| Workspace packages     | Root plus declared `pnpm-workspace.yaml` packages or `package.json` workspaces; without declarations, packages found recursively below the root                          |
| App server             | The package's `dev` script, unless it runs `storybook dev` or `playwright test`; other script names require explicit configuration                                       |
| Storybook server       | A script containing `storybook dev`; otherwise a discovered `.storybook/main.*` config                                                                                   |
| Playwright candidate   | A `playwright.config.*` file, an `@playwright/test` dependency, or a `playwright test` script, together with an app dev script in the same package                       |
| Framework              | A script that starts with `next dev`, `vite`, or `storybook dev` and contains no `;`, `&`, `\|`, `#`, or standalone `--` gets framework flags; anything else is `custom` |
| Local proxy            | HTTPS on port 443, suffix `localhost`, hosts synchronization enabled                                                                                                     |
| Auth and public access | No callback paths or tunnels are inferred                                                                                                                                |

Package-manager detection stays at the selected project root. A declaration takes precedence over stale lockfiles.
Conflicting lockfiles without a declaration require you to choose a manager in `package.json` or an explicit config.

Scripts that contain the word `dev-domains`, `portless`, `run-p`, or `concurrently`, or that run the `turbo` command,
are excluded from detection. A `--turbo` flag doesn't count, so `next dev --turbo` is still detected as a Next.js
server. Point configuration at the underlying server script when an aggregate or wrapper command is involved. A
`playwright test` script is never used as the app server.

There is no universally required development script name. `dev` is the default convention; scripts with any other name
work through an explicit `script` setting. Detection does not guess whether `start`, `serve`, or a custom script is a
development server, production server, or build task.

### Storybook and Playwright discovery

Discovery makes one walk through the project, looking for `.storybook/main.*` and `playwright.config.*` files with a
`ts`, `mts`, `cts`, `js`, `mjs`, `cjs`, `tsx`, or `jsx` extension. It finds them without importing or running them.

- A config belongs to its nearest package, including nested paths such as `tests/playwright.config.ts`. A config inside
  a package that your workspace declarations leave out is ignored.
- The walk honors workspace exclusions. It skips symlinks, `node_modules`, generated output (`dist`, `build`, `out`,
  `coverage`, `storybook-static`, `playwright-report`, and `test-results`), and hidden directories other than
  `.storybook`.
- Use explicit configuration for unusual layouts, or when discovery reports too many packages or directories.

For Storybook:

- A script containing `storybook dev` takes precedence over a config file.
- With one config and no such script, the candidate runs the installed binary as `storybook dev --config-dir`, followed
  by the config's directory. Nothing is downloaded.
- Several Storybook scripts in one package, or several configs without a script, require explicit configuration.
- An empty `.storybook` folder or a Storybook dependency alone doesn't make a runnable server.

Finding Playwright doesn't reveal which server your tests need, so the suggested E2E endpoint keeps to the package's own
dev server:

- It starts a separate copy of the package's `dev` server. It doesn't read Playwright's `webServer` configuration.
- It's named `app-e2e`, or `<package>-app-e2e` in a workspace package.
- `init --yes` omits it, and the wizard lists it unchecked. Select it there, or run it by name when using zero
  configuration.

A dependency on the `playwright` browser library alone doesn't count as an E2E test setup. Separate test-only packages
and cross-package server relationships need explicit configuration. See [Playwright](#playwright) before running an E2E
server alongside your app.

## Domain naming

A hostname consists of the resolved endpoint name followed by `domain`:

```text
<resolved name>.<domain>
```

The origin adds the protocol and, when it is not the protocol's standard port, the proxy port. For example,
`proxy: { https: false, port: 8080 }` produces `http://shop.localhost:8080`. The dynamically assigned app port does not
appear in the browser-facing origin.

### Default names

For a project named `shop`, a workspace package named `web`, and a worktree folder named `fix-login`:

| Detected endpoint                  | Primary checkout             | Linked worktree                        |
| ---------------------------------- | ---------------------------- | -------------------------------------- |
| Root app: `app`                    | `shop.localhost`             | `shop-fix-login.localhost`             |
| Root Storybook: `stories`          | `shop-stories.localhost`     | `shop-fix-login-stories.localhost`     |
| Root E2E: `app-e2e`                | `shop-app-e2e.localhost`     | `shop-fix-login-app-e2e.localhost`     |
| Workspace app: `web-app`           | `shop-web-app.localhost`     | `shop-fix-login-web-app.localhost`     |
| Workspace Storybook: `web-stories` | `shop-web-stories.localhost` | `shop-fix-login-web-stories.localhost` |
| Workspace E2E: `web-app-e2e`       | `shop-web-app-e2e.localhost` | `shop-fix-login-web-app-e2e.localhost` |

These are discovery conventions. In a manually written config, the schema defaults are
`primaryName: "{project}-{service}"` and `name: "{project}-{worktree}-{service}"`. Set the templates explicitly when you
want a shorter root app name, as in the configuration example below.

The **primary checkout** is Git's original working checkout. A **linked worktree** is another checkout created with Git
worktrees. The primary checkout never receives a `main` label, even when its branch is named `main`. A linked worktree
folder named `main` does receive that label. Outside Git, the project is treated as a primary checkout.

### Using your own domain

For a domain you control, such as `example.com`, this configuration puts the primary app at `local.example.com` and
Storybook at `stories.local.example.com`:

```ts
// dev-domains.config.ts
import { defineConfig } from "@buildkitgg/dev-domains"

export default defineConfig({
  project: "shop",
  domain: "example.com",
  packageManager: "pnpm",
  endpoints: {
    app: {
      cwd: "apps/web",
      command: ["next", "dev"],
      framework: "next",
      primaryName: "local",
      name: "{worktree}.local"
    },
    stories: {
      kind: "storybook",
      cwd: "apps/web",
      script: "storybook",
      framework: "storybook",
      primaryName: "stories.local",
      name: "{worktree}.stories.local"
    }
  }
})
```

Use `domain: "example.com"` with `primaryName: "local"` to get the bare `local.example.com` address. Setting only
`domain: "local.example.com"` keeps the name template's prefix, such as `shop.local.example.com` for a detected root
app.

The same convention can cover additional servers you configure:

| Server        | `primaryName`   | `name` for linked worktrees | Primary hostname            |
| ------------- | --------------- | --------------------------- | --------------------------- |
| Web app       | `local`         | `{worktree}.local`          | `local.example.com`         |
| Separate API  | `api.local`     | `{worktree}.api.local`      | `api.local.example.com`     |
| Storybook     | `stories.local` | `{worktree}.stories.local`  | `stories.local.example.com` |
| Dedicated E2E | `e2e.local`     | `{worktree}.e2e.local`      | `e2e.local.example.com`     |

A separate API server uses an endpoint key such as `api` with `kind: "app"`; there is no separate `api` kind. When API
routes, auth callbacks, or webhook handlers live in the web app, they share its origin and use paths such as `/api`,
`/callback`, or `/api/webhooks/payments`.

Use Portless hosts synchronization, or arrange loopback DNS for every generated hostname. If managing DNS yourself,
cover the base `local.example.com` as well as the worktree and service names, and set `proxy.syncHosts: false`.
`dev-domains` does not create DNS records or provider registrations. A real domain resolving to loopback still points to
your machine; public webhook delivery requires a [tunnel](#webhook-tunnels).

## Domain normalization and collisions

Automatically discovered names are normalized before they enter the templates. Values you write explicitly in a
configuration file are validated, rather than silently rewritten.

| Input                                   | Normalization                                                                                                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovered project name                 | Remove the leading npm scope marker, convert the scope separator to a hyphen, lowercase, replace runs of characters other than `a-z`, `0-9`, and `-` with `-`, limit to 32 characters, trim edge hyphens; use `app` if empty |
| Discovered workspace label              | Use the unscoped package name or folder name, then apply the same lowercase, replacement, 32-character limit, and fallback rules                                                                                             |
| Linked worktree name                    | Use the folder basename, lowercase, replace unsupported character runs with `-`, and trim edge hyphens; reject empty names or names longer than 63 characters                                                                |
| Explicit project name and endpoint keys | Require lowercase DNS labels of 1–63 characters, beginning and ending with a letter or digit                                                                                                                                 |
| Resolved name templates                 | Allow dot-separated lowercase DNS labels; each label must be 1–63 characters                                                                                                                                                 |
| Full hostname                           | At most 253 characters, including the configured suffix                                                                                                                                                                      |

For example, `@acme/shop` becomes project `acme-shop`, `@acme/web` supplies workspace label `web`, and a worktree folder
named `Fix_Login!` becomes `fix-login`. No branch name, commit ID, or path hash is added. Moving a linked worktree
without renaming its folder keeps its name; renaming the folder changes it.

Normalization can produce collisions: `fix_login` and `fix-login` become the same label, and long discovered project
names can share the same first 32 characters. Independent clones with identical names can also collide. Duplicate
endpoint keys are rejected during discovery. Resolution rejects endpoints that produce the same name, and startup
reports a hostname already owned by a running server. Choose a distinct project name, worktree folder, or name template.
Existing routes are never forcibly replaced.

Custom layouts can also overlap service and worktree names: a worktree named `stories` would put its app at the same
address as the primary Storybook in the example above. Choose different names or templates for that layout.

## Configuration files

Use a saved configuration when you need custom naming, a server the detector cannot identify, or application-specific
settings. TypeScript configuration uses the exported `defineConfig` helper:

```ts
// dev-domains.config.ts
import { defineConfig } from "@buildkitgg/dev-domains"

export default defineConfig({
  project: "shop",
  packageManager: "pnpm",
  endpoints: {
    app: {
      script: "dev",
      framework: "vite",
      primaryName: "{project}",
      name: "{project}-{worktree}"
    }
  }
})
```

`defineConfig` supplies TypeScript checking and runtime validation. A plain JSON config receives the same runtime
validation. The wizard writes `dev-domains.json`; you can maintain that file or replace it with a typed config.

### File discovery and precedence

The supported automatically discovered filenames are:

- `dev-domains.config.ts`
- `dev-domains.config.mts`
- `dev-domains.config.js`
- `dev-domains.config.mjs`
- `dev-domains.config.json`
- `dev-domains.json`

Resolution follows this order:

1. A file selected with `--config`, relative to `--cwd`.
2. The nearest supported config, searching from `--cwd` up to the Git checkout boundary. Outside Git, only the selected
   directory is searched.
3. Detected defaults when no file is found.

Multiple supported configs in one directory are an error. The selected file's directory becomes the configuration root;
endpoint `cwd` paths are relative to it. At startup, endpoint directories must stay within that root, including after
resolving symlinks.

A saved configuration is complete: detected endpoints are not merged into it. In particular, an omitted `packageManager`
in a saved config defaults to **npm**, while zero-config discovery detects the manager. Specify your manager when
authoring a config for pnpm, Yarn, or Bun.

Only the selected configuration file is loaded. The CLI does not load `.env` files, user-wide settings, remote
configuration, or environment-specific overrides. Your framework may still load its own environment files. JavaScript
and TypeScript configs execute as code when loaded; use configs from repositories you trust. `detect` inspects project
conventions without loading a dev-domains config.

### JSON editor support

Generate the schema from the installed version:

```sh
npx @buildkitgg/dev-domains schema > dev-domains.schema.json
```

Then reference it from `dev-domains.json` for editor completion and validation:

```json
{
  "$schema": "./dev-domains.schema.json",
  "project": "shop",
  "packageManager": "pnpm",
  "endpoints": {
    "app": {
      "script": "dev",
      "framework": "vite",
      "primaryName": "{project}",
      "name": "{project}-{worktree}"
    }
  }
}
```

## Configuration schema

Unknown keys are rejected. Defaults below describe a saved configuration; discovery may generate more specific values.
Names, paths, and templates are validated when the config is loaded or resolved.

### Root fields

| Field            | Type                                    | Default or requirement       | Description                                                                                 |
| ---------------- | --------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| `$schema`        | `string`                                | Optional                     | JSON editor schema reference                                                                |
| `project`        | `string`                                | Required                     | Lowercase DNS label identifying the project                                                 |
| `domain`         | `string`                                | `"localhost"`                | Hostname suffix without protocol, path, or port; lowercase DNS labels, up to 190 characters |
| `packageManager` | `"npm"`, `"pnpm"`, `"yarn"`, or `"bun"` | `"npm"`                      | Manager used to run endpoint scripts                                                        |
| `proxy`          | Object                                  | Defaults below               | Shared Portless proxy settings                                                              |
| `endpoints`      | Record of endpoint objects              | Required, at least one entry | Keys are lowercase DNS labels used in CLI commands and the `{service}` template             |

### Proxy fields

| Field             | Type                  | Default                 | Description                                                                                                  |
| ----------------- | --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `proxy.port`      | Integer, 1–65535      | `443`                   | Browser-facing proxy port, not an app's upstream port                                                        |
| `proxy.https`     | `boolean`             | `true`                  | Serve local origins over HTTPS                                                                               |
| `proxy.syncHosts` | `boolean`             | `true`                  | Allow Portless to synchronize local hosts entries                                                            |
| `proxy.domains`   | Nonempty string array | `[domain]` when omitted | Explicit aliases for this project; must include its `domain`; each suffix follows the same rules as `domain` |

### Endpoint fields

Each entry in `endpoints` has these fields. Set **exactly one** of `script` or `command`.

| Field         | Type                                             | Default or requirement             | Description                                                                                     |
| ------------- | ------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `kind`        | `"app"`, `"storybook"`, or `"e2e"`               | `"app"`                            | Endpoint purpose; the Playwright helper requires `"e2e"`                                        |
| `cwd`         | `string`                                         | `"."`                              | Server working directory, relative to the configuration root                                    |
| `primaryName` | `string`                                         | `"{project}-{service}"`            | Name template used in the primary checkout                                                      |
| `name`        | `string`                                         | `"{project}-{worktree}-{service}"` | Name template used in a linked worktree                                                         |
| `script`      | Nonempty string                                  | Required unless `command` is set   | Script from `cwd`'s `package.json`; it must exist and must not call `dev-domains` or `portless` |
| `command`     | Nonempty string array                            | Required unless `script` is set    | Executable followed by arguments; each element must be nonempty and contain no NUL character    |
| `framework`   | `"next"`, `"vite"`, `"storybook"`, or `"custom"` | `"custom"`                         | Selects host and port flag adaptation; it is independent of `kind`                              |
| `env`         | Record of string values                          | `{}`                               | Additional child-process environment variables; supports templates                              |
| `auth`        | String array                                     | `[]`                               | Callback paths included in the `urls` output                                                    |
| `tunnel`      | Object                                           | Omitted                            | Optional public webhook tunnel settings below                                                   |

Environment keys must start with a letter or underscore and contain only letters, digits, and underscores. `PORT`,
`HOST`, keys starting with `PORTLESS`, and keys starting with `BUILDKIT_` are reserved. Keep secrets in your environment
or your application's secret-loading mechanism rather than committing them to this file.

### Tunnel fields

These fields apply only when an endpoint has a `tunnel` object:

| Field              | Type                  | Default or requirement | Description                                                                                                                |
| ------------------ | --------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `tunnel.command`   | Nonempty string array | Required               | Tunnel executable and arguments; one argument must contain `{url}`, the local gateway's address, or the tunnel won't start |
| `tunnel.paths`     | Nonempty string array | Required               | Exact allowed POST paths                                                                                                   |
| `tunnel.publicUrl` | HTTPS origin string   | Optional               | An existing stable public origin, used for display and `urls` output; it does not provision a tunnel                       |

`auth` and `tunnel.paths` values must begin with one `/`. They cannot include query strings, fragments, backslashes,
percent encoding, or `.` / `..` path segments. Tunnel paths are exact matches, not wildcard patterns. `tunnel.publicUrl`
cannot include credentials, a query, a fragment, or a path other than `/`.

## Templates and environment variables

Templates expand in name fields, command arguments, and environment values. Unknown template variables cause an error.
`script` and `cwd` are literal values; callback and allowed webhook paths are also literal.

| Variable     | Meaning                                                                | Where it can be used                                                                                               |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `{project}`  | Configured project name                                                | Name templates, server command/env, tunnel command                                                                 |
| `{worktree}` | Normalized linked-worktree folder name; empty for the primary checkout | Name templates, server command/env, tunnel command                                                                 |
| `{service}`  | Endpoint key, such as `app` or `stories`                               | Name templates, server command/env, tunnel command                                                                 |
| `{root}`     | Absolute configuration or detected project root                        | Name templates, server command/env, tunnel command; filesystem separators usually make it unsuitable for DNS names |
| `{hostname}` | Resolved hostname without protocol or port                             | Server command/env and tunnel command                                                                              |
| `{origin}`   | Resolved browser-facing origin, including a nonstandard proxy port     | Server command/env and tunnel command                                                                              |
| `{port}`     | Dynamically assigned app-server port                                   | Server command and env only                                                                                        |
| `{url}`      | Restricted webhook gateway's loopback URL                              | Tunnel command only                                                                                                |

Every server receives these environment variables:

| Variable               | Value                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| `PORT`                 | Assigned app-server port                                          |
| `HOST`                 | `127.0.0.1`                                                       |
| `DEV_DOMAINS_ORIGIN`   | Resolved browser-facing origin                                    |
| `DEV_DOMAINS_HOSTNAME` | Resolved hostname                                                 |
| `DEV_DOMAINS_WORKTREE` | Normalized worktree folder name, or empty in the primary checkout |

For example, an endpoint can set `env: { APP_URL: "{origin}", AUTH_REDIRECT_URI: "{origin}/callback" }`. Standard
process environment variables are inherited. The runtime values listed above take precedence over same-named values
inherited from the shell or supplied through `env`.

The server also receives a few variables for its tools:

- `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` lists the endpoint's hostnames, so Vite accepts them without allowed-hosts
  configuration.
- With HTTPS, `NODE_EXTRA_CA_CERTS` points at Portless's local certificate authority, so Node.js code in the server
  trusts the local origins. A value you already set is kept.
- `PORTLESS_URL` holds the origin.
- `BUILDKIT_ACTIVE` makes a nested `dev-domains run` inside the server stop with a recursion error.

## Server commands and frameworks

Use `script` to run an existing package script, or `command` for an executable and argument array. Arguments remain
separate, so a file path containing spaces stays one argument. Command arrays are not interpreted as shell expressions.

For a custom server that accepts a port flag:

```ts
api: {
  kind: "app",
  cwd: "apps/api",
  command: ["node", "server.js", "--port", "{port}"],
  framework: "custom"
}
```

For a custom server that reads `PORT` and `HOST` directly, `command: ["node", "server.js"]` is sufficient. Package-local
binaries are available on the server's `PATH`.

| Framework   | Flags appended to the server invocation                                    |
| ----------- | -------------------------------------------------------------------------- |
| `next`      | `--hostname 127.0.0.1 --port <assigned port>`                              |
| `vite`      | `--host 127.0.0.1 --port <assigned port> --strictPort`                     |
| `storybook` | `--host 127.0.0.1 --port <assigned port> --exact-port --no-open --ci`      |
| `custom`    | None; the server must honor `PORT` / `HOST` or explicit `{port}` arguments |

Use `framework: "custom"` for compound shell scripts or commands that cannot accept appended flags. Detection does this
automatically for compound scripts. In a saved config, choose the appropriate framework yourself. `kind` does not select
it for you.

If you replace your `dev` script with `npx @buildkitgg/dev-domains run app`, configure the endpoint with the server
command directly, such as `command: ["vite"]` and `framework: "vite"`. Pointing that endpoint back to `script: "dev"`
would start the CLI again and is rejected. You do not need a second package script with a special name.

Your framework still controls allowed hosts, development origins, and output directories. Add your generated hostnames
to its configuration where required; Vite reads them from the environment. When a server exits, its exit code is
propagated. Custom servers must fail on a port conflict rather than silently switching ports.

## Playwright

You can test an already running app by setting Playwright's `use.baseURL` to its origin. To let Playwright manage a
separate server, configure a dedicated endpoint:

```ts
// Add under endpoints in dev-domains.config.ts.
"app-e2e": {
  kind: "e2e",
  cwd: "apps/web",
  command: ["vite"],
  framework: "vite"
}
```

Then use the helper in `playwright.config.ts`:

```ts
import { playwrightServer } from "@buildkitgg/dev-domains/playwright"
import { defineConfig } from "@playwright/test"

export default defineConfig({
  ...(await playwrightServer("app-e2e")),
  testDir: "./tests"
})
```

`playwrightServer(service, cwd?)` loads the project from `cwd` or `process.cwd()`. It returns `use.baseURL` and a
`webServer` configuration that runs `dev-domains run` for the endpoint from the configuration root, waits up to 120
seconds, and sets `reuseExistingServer: false`. If you add other Playwright `use` or `webServer` options, merge those
nested objects so you preserve the helper's values. In a monorepo, use the exact configured endpoint key, such as
`web-app-e2e`, and a working directory from which the intended dev-domains config can be found.

The endpoint's script must start a server, not run `playwright test`. The helper does not install Playwright or edit its
configuration. Run `npx @buildkitgg/dev-domains setup` before the test run on a development machine.

A dedicated endpoint gets a separate hostname and port. Configure separate build output or caches when your framework
requires them; this package does not change those settings or assign a framework output directory. Tests that need a
production build, another package, or a remote deployment need an explicit server configuration. Databases, storage, and
credentials remain shared unless you configure them separately.

## Node.js tooling

Build scripts and local workers can read an endpoint without starting a server:

```ts
import { getEndpoint } from "@buildkitgg/dev-domains/node"

const app = await getEndpoint("app")
process.env.APP_URL = app.origin
```

`getEndpoint(service, cwd?)` returns a promise containing `service`, `hostname`, `origin`, `callbacks` (resolved auth
URLs), and `cwd` (the server's absolute working directory). It uses the CLI's configuration discovery and worktree
naming rules; `cwd` defaults to `process.cwd()`. An unknown endpoint throws. The exported `EndpointInfo` type describes
the result. This Node.js-only helper can execute trusted local configuration files, just like the CLI. It does not start
servers or change networking settings.

## Authentication callbacks

Auth callbacks are paths on the server that handles authentication. Add paths to `auth` to include their full URLs in
`npx @buildkitgg/dev-domains urls` output:

```ts
// Add to the endpoint that serves these routes.
auth: ["/callback", "/api/auth/callback/github"],
env: { AUTH_REDIRECT_URI: "{origin}/callback" }
```

Register the resulting URLs with your authentication or OAuth provider and connect the environment variables to your
application's auth configuration. `auth` is descriptive: it does not create routes, update provider dashboards, or
configure an SDK. The environment variable names in these examples are application choices.

When a provider requires a real domain, use the custom-domain layout above. Keep primary and worktree origins in the
appropriate redirect, allowed-origin, or API-key restriction settings. Accepted wildcard patterns differ by service; use
the exact `urls` output where required. A separate auth subdomain is only useful if you actually run a separate auth
server.

## Webhook tunnels

A remote service cannot deliver a webhook to a loopback-only address. An optional tunnel makes selected POST routes
reachable through a public URL while the rest of the app remains behind the local proxy.

Add a tunnel to the endpoint that already serves the webhook handler. For example, with `cloudflared` installed:

```ts
// Add to the app or API endpoint.
tunnel: {
  command: ["cloudflared", "tunnel", "--url", "{url}"],
  paths: ["/api/webhooks/payments"]
}
```

Start the app first, then open the tunnel in another terminal:

```sh
npx @buildkitgg/dev-domains run app
```

```sh
npx @buildkitgg/dev-domains tunnel app
```

The tunnel provider prints its public URL. Register that origin plus `/api/webhooks/payments` with the sending service.
No separate webhook subdomain is required. A quick tunnel URL may change after restart. For persistent registrations,
configure a stable tunnel with your provider and optionally record its HTTPS origin in `tunnel.publicUrl`. That property
reports an existing address; it does not reserve a domain or configure the tunnel command.

The tunnel reaches your app through a restricted local gateway, which:

- Accepts only POST requests whose path exactly matches an entry in `tunnel.paths`, and answers anything else with 404.
- Preserves query strings, raw request bytes, and signature headers.
- Strips hop-by-hop headers and the inbound `Forwarded`, `X-Forwarded-For`, and `X-Forwarded-Host` headers.
- Rejects request bodies over 1 MiB with 413.
- Answers 502 when the app can't be reached or doesn't respond within 15 seconds, and 503 when the endpoint has stopped.
- Never logs or stores payloads.

Your application must validate provider signatures. Providers that require a GET verification challenge need a different
ingress arrangement, because this gateway is POST-only.

Install and authenticate the tunnel executable separately. It runs from the configuration root and inherits the shell
environment, rather than the endpoint's server `env` overrides. Keep credentials in the provider's login store or
environment. Closing the tunnel command stops its process tree and gateway while leaving the app and shared proxy
running. A hosted receiver, durable delivery, and replay are not included.

## Sharing a proxy across projects

One Portless proxy can serve every project on a machine, each with its own domain: `local.example.com` and
`local.example.org` can run together on the same proxy. Starting an endpoint leaves other servers running. Projects that
share the proxy follow these rules:

- Every project must use the same proxy port and TLS setting. If the running proxy differs, startup stops with an error
  and leaves the proxy running.
- Hosts synchronization is set when the proxy starts. If it started with synchronization disabled, `syncHosts: true`
  cannot change that running process; coordinate proxy configuration or configure DNS yourself. Either way, every custom
  hostname must resolve to loopback.
- A collision means the **complete hostname** is occupied, not just the endpoint name. A running server keeps its
  hostname; choose another name if the CLI reports a collision.
- Backend ports are assigned automatically. After a port conflict, startup can run the server command up to three times,
  so server commands should be safe to repeat.

`npx @buildkitgg/dev-domains doctor` helps diagnose the current state.

To give one project's endpoints additional aliases, configure an explicit list:

```ts
// Root configuration fields, alongside project and endpoints.
domain: "example.com",
proxy: {
  domains: ["localhost", "example.com"],
  port: 443,
  https: true,
  syncHosts: true
}
```

An explicit list registers each endpoint under those suffixes only, and `domain` selects its canonical origin. Leave
`proxy.domains` unset unless this project's endpoints need aliases.

## CI usage

Commit a configuration and use explicit endpoint names in noninteractive jobs. The Playwright helper can start a
dedicated test server, or you can keep your existing loopback-based Playwright setup.

For jobs that use Portless:

- Set a job-specific `PORTLESS_STATE_DIR` and choose an unprivileged proxy port. For example, a CI config can use
  `proxy: { https: false, port: 8080, syncHosts: false }`.
- With hosts synchronization disabled, make sure generated hostnames resolve to loopback on the runner.
- HTTP avoids a certificate-trust step; HTTPS requires the runner to trust the local certificate authority.
- Select a complete CI config through the normal file-loading rules, or with `--config` for CLI commands. There is no
  implicit environment-specific config merge.
- The Playwright helper uses normal config discovery from its `cwd` and doesn't accept the CLI's `--config` option. If
  you use the helper, place the CI config where that lookup finds it.
- Concurrent jobs sharing a machine need compatible shared proxy settings or distinct proxy ports. A separate state
  directory alone doesn't free a bound port.

## Command reference

These are complete consumer-facing commands. They use the locally installed package; follow the installation steps above
first.

| Command                                         | Purpose                                                                       | Supported project options                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| `npx @buildkitgg/dev-domains`                   | Same as `run` with no endpoint name; select an endpoint if several exist      | `--cwd`, `--config`                                    |
| `npx @buildkitgg/dev-domains run [endpoint]`    | Start one detected or configured endpoint                                     | `--cwd`, `--config`                                    |
| `npx @buildkitgg/dev-domains init`              | Run the setup wizard and save `dev-domains.json`                              | `--cwd`, `--yes`, `--dry-run`, `--project`, `--domain` |
| `npx @buildkitgg/dev-domains detect`            | Print detected candidates as JSON, ignoring saved dev-domains config          | `--cwd`                                                |
| `npx @buildkitgg/dev-domains urls`              | Print endpoint origins, callback URLs, and configured webhook origins as JSON | `--cwd`, `--config`                                    |
| `npx @buildkitgg/dev-domains setup`             | Start the Portless proxy with project settings                                | `--cwd`, `--config`                                    |
| `npx @buildkitgg/dev-domains status`            | List active Portless routes                                                   | `--cwd`, `--config`                                    |
| `npx @buildkitgg/dev-domains doctor`            | Check proxy, DNS, and certificate trust                                       | `--cwd`, `--config`                                    |
| `npx @buildkitgg/dev-domains tunnel [endpoint]` | Expose an endpoint's configured webhook POST paths                            | `--cwd`, `--config`                                    |
| `npx @buildkitgg/dev-domains schema`            | Print the configuration JSON Schema                                           | None                                                   |

`--cwd` defaults to the current directory. `--config` is a file path relative to `--cwd`. Use `--help` on a command for
its options. `run` and `tunnel` require an endpoint name in noninteractive sessions when more than one candidate exists;
`tunnel` only offers endpoints that have a `tunnel` object. Put options after the command name.

The CLI never rewrites package scripts. It propagates server exit codes, exits with 1 on an error and 130 when you
cancel a prompt, and releases the endpoint's hostname when the server stops normally. The shared proxy stays available
for other servers. After a forced termination, check `status` and stop any remaining server process you own before
restarting it. `PORTLESS_STATE_DIR` can select a separate state directory; most consumers should keep the default shared
state.

## Troubleshooting

| Symptom                                              | What to check                                                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| No endpoints were detected                           | Run `detect`; check the app script conventions or add an explicit `command` / `script` endpoint                                  |
| A wrapped script is rejected                         | Set `command` to the server executable, or reference a script that starts the server directly                                    |
| An endpoint name is ambiguous                        | Use `urls` for configured names or `detect` for discovered names, then pass one to `run`                                         |
| Multiple configs or Storybook candidates were found  | Keep one dev-domains config per directory; select the intended Storybook script or config directory explicitly                   |
| The wrong package manager is used                    | In a saved config, set `packageManager`; during discovery, check the root declaration and conflicting lockfiles                  |
| A hostname is already in use                         | Check `status`, then choose a distinct name or stop the server you own; do not take over another process's route                 |
| The proxy has different settings                     | Align port and TLS settings with the existing shared proxy before restarting your endpoint                                       |
| The hostname does not resolve or HTTPS is untrusted  | Run `doctor`; check loopback DNS or hosts synchronization and complete Portless certificate setup                                |
| The framework rejects the hostname                   | Configure its allowed hosts or development origins for your generated domains                                                    |
| App and E2E servers conflict despite different ports | Configure separate framework build/output directories or caches                                                                  |
| A webhook returns 404                                | Confirm it is a POST request to an exact allowed path; GET verification challenges are not supported by this gateway             |
| A webhook returns 502, 503, or 413                   | 502: the app couldn't be reached or didn't respond within 15 seconds; 503: start the endpoint again; 413: the body exceeds 1 MiB |
| A webhook cannot reach the app                       | Start the target endpoint first, verify the provider's current public URL, and check the tunnel process                          |
