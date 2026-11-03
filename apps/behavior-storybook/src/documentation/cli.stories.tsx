import type { Meta, StoryObj } from "@storybook/react-vite"
import { Documentation, Code } from "./Documentation.js"
import { PackageOverview } from "./PackageOverview.js"

function OverviewPage() {
  return <PackageOverview name="cli" />
}

const meta = { title: "Tooling/cli", parameters: { buildkitDocumentation: true } } satisfies Meta

export default meta

export const Overview: StoryObj<typeof meta> = { render: () => <OverviewPage /> }

export const CreateAnApp: StoryObj<typeof meta> = {
  name: "Create an app",
  render: () => (
    <Documentation
      title="Create a Buildkit app"
      summary="In a terminal, the CLI shows the plan and asks before it writes. --yes or a reviewed --plan applies without asking; other runs without a terminal write nothing."
    >
      <h2>Answer the questions</h2>
      <Code>{"npx @buildkitgg/cli create app my-app"}</Code>
      <p>
        The CLI asks for the mode and localization, shows the plan, and asks once before it writes anything. Installed
        globally with <code>npm install -g @buildkitgg/cli</code>, the command is{" "}
        <code>buildkit create app my-app</code>.
      </p>
      <h2>Or pass the answers as flags</h2>
      <Code>{"npx @buildkitgg/cli create app my-app --mode ssr --with i18n --set i18n.locales=en,fr --yes"}</Code>
      <p>
        <code>--yes</code> accepts every default but never makes a decision for you. <code>--json</code> prints one JSON
        envelope without prompting.
      </p>
      <h2>Change the app later</h2>
      <Code>{"pnpm buildkit add i18n\npnpm buildkit config set i18n.locales=en,fr,de\npnpm buildkit upgrade"}</Code>
      <p>
        New apps pin the CLI as a dev dependency. To upgrade, install the newer CLI with{" "}
        <code>pnpm add -D @buildkitgg/cli@latest</code>, then run <code>upgrade</code>, which merges template fixes into
        your code.
      </p>
      <a href="https://github.com/betterapps-hq/buildkit/tree/main/packages/tooling/cli#readme">Full command list ↗</a>
    </Documentation>
  )
}

const addons = [
  ["ci", "Always included", "A GitHub Actions workflow: buildkit check, lint, format, build and type-check"],
  ["i18n", "Optional add-on", "Lingui catalogs, localized URLs and the html lang and dir attributes"]
] as const

export const WhatCreateAsks: StoryObj<typeof meta> = {
  name: "What create asks",
  render: () => (
    <Documentation
      title="What buildkit create asks"
      summary="The app template is a React app on TanStack Start, in ssr or spa mode."
    >
      <h2>Questions and add-ons</h2>
      <div className="bk-table">
        <table>
          <thead>
            <tr>
              <th>Add-on</th>
              <th>Offered as</th>
              <th>What it writes</th>
            </tr>
          </thead>
          <tbody>
            {addons.map(([name, offered, writes]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td>{offered}</td>
                <td>{writes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>No cloud in the app</h2>
      <p>
        Apps have no Wrangler config, bindings or cloud names. Starter files import generated glue from{" "}
        <code>src/generated/buildkit/</code> once, so adding an add-on never rewrites them. It changes the generated
        files and adds what it needs, such as dependencies, settings, its own source files and workflows.
      </p>
      <h2>Where the template comes from</h2>
      <p>
        The template and add-ons are <code>@buildkitgg/catalog</code>, which the CLI installs for you. Import it only to
        plan Buildkit apps from your own tools, or to publish templates that extend it.
      </p>
      <a href="https://github.com/betterapps-hq/buildkit/tree/main/packages/tooling/catalog#readme">
        The catalog’s extension points and starter files ↗
      </a>
    </Documentation>
  )
}
