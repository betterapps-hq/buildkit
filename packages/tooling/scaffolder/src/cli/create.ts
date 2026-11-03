import { defineCommand, type ArgsDef, type CommandDef } from "citty"
import { expandTemplate, findQuestion } from "../manifest/catalog.js"
import type { CatalogManifest } from "../manifest/types.js"
import { CliRuntime, questionIds, type CliOptions } from "./commands.js"

const shared: ArgsDef = {
  "dry-run": { type: "boolean", description: "Plan and show the changes, and write nothing" },
  json: { type: "boolean", description: "Print one JSON envelope, and never prompt" },
  yes: { type: "boolean", alias: "y", description: "Apply without asking. It never makes a decision for you" },
  out: { type: "string", description: "Save the plan, patches and conflicts to a folder" },
  plan: { type: "string", description: "Apply a saved plan.json, if the project hasn't changed since" },
  diff: { type: "string", description: "Patches to save with --out: none, user (default) or all" },
  resolve: {
    type: "string",
    description: "Answer a conflict: <id>=keep-current, take-incoming or file:<path>. Repeatable"
  },
  conflict: { type: "string", description: "markers writes conflict markers into starter files instead of stopping" },
  "catalog-version": { type: "string", description: "Plan with an earlier, cached catalog version" },
  cwd: { type: "string", description: "The project folder. Defaults to the current folder" }
}

const descriptions = {
  create: "Create a project from a template",
  add: "Add an add-on or an add-on package, or answer a question such as which database",
  config: "Show the config, get an option, or set options",
  upgrade: "Upgrade to the installed catalog version, running migrations",
  sync: "Bring generated files and the lock in line with the config",
  check: "Fail when generated files or the lock are out of date",
  status: "Show the files the engine manages and whether you changed them",
  explain: "Explain who contributes a path, an add-on or an entry",
  plan: "Show a saved plan: plan show <file>",
  catalog: "Describe every question as JSON, fetch an earlier catalog version, or check a package or the pins",
  schema: "Print JSON Schemas for the config, the lock and plan requests",
  recover: "Roll back an interrupted apply"
} satisfies Record<string, string>

function positional(description: string): ArgsDef[string] {
  return { type: "positional", required: false, description }
}

/** A question's title for its flag's help: the catalog's, else the first template's that asks it. */
function questionTitle(catalog: CatalogManifest, id: string): string {
  const own = findQuestion(catalog, id)

  if (own) {
    return own.title
  }

  for (const template of catalog.templates) {
    try {
      const question = expandTemplate(catalog, template.id)?.questions.find((candidate) => candidate.id === id)

      if (question) {
        return question.title
      }
    } catch {
      // The catalog check reports a template that doesn't expand.
    }
  }

  return id
}

/** A citty command tree for a product CLI. Each subcommand runs the shared handler with its raw arguments. */
export function createCli(options: CliOptions): CommandDef {
  const runtime = new CliRuntime(options)

  const questionArgs: ArgsDef = Object.fromEntries(
    questionIds(options.catalog).map((id) => {
      const question = questionTitle(options.catalog, id)

      return [id, { type: "string", description: `${question}. Use --no-${id} to answer no` }]
    })
  )

  const alongside: ArgsDef[string] = {
    type: "string",
    description: "Add an add-on with this change, as a decision's choice does. Repeatable, or comma-separated"
  }

  const extra = new Map<string, ArgsDef>([
    [
      "create",
      {
        template: positional("Template to start from"),
        folder: positional("Folder to create"),
        mode: { type: "string", description: "Target mode, when the template offers more than one" },
        preset: { type: "string", description: "Saved answers to start from" },
        name: { type: "string", description: "Project name. Defaults to the folder name" },
        with: {
          type: "string",
          description: "Add an add-on to the question that offers it, or as an extra. Repeatable, or comma-separated"
        },
        without: {
          type: "string",
          description: "Take an add-on out of its question's answer. Repeatable, or comma-separated"
        },
        set: { type: "string", description: "Set an option: <add-on>.<option>=<value>. Repeatable" },
        adopt: { type: "boolean", description: "Bring an existing project in. Your files stay yours" },
        ...questionArgs
      }
    ],
    [
      "add",
      {
        addon: positional("Add-ons, an add-on package such as @acme/turrets, or a question such as database"),
        replace: { type: "string", description: "Replace an installed add-on with one it conflicts with" },
        set: { type: "string", description: "Set an option: <add-on>.<option>=<value>. Repeatable" },
        ...questionArgs
      }
    ],
    [
      "upgrade",
      {
        list: { type: "boolean", description: "Show what an upgrade changes, and write nothing" },
        with: alongside
      }
    ],
    [
      "catalog",
      {
        registry: { type: "boolean", description: "With check: check each of the catalog's pins against npm" },
        "min-age": {
          type: "string",
          description: "With --registry: the days a pin's newest match must be out. Default 1"
        }
      }
    ],
    ["sync", { with: alongside }],
    ["config", { with: alongside }]
  ])

  const subCommands = Object.fromEntries(
    Object.entries(descriptions).map(([name, description]) => [
      name,
      defineCommand({
        meta: { name, description },
        args: { ...extra.get(name), ...shared },
        async run({ rawArgs }) {
          process.exitCode = await runtime.run(name, rawArgs)
        }
      })
    ])
  )

  // init was create's name before 0.6. It still works, unlisted, for a release.
  subCommands.init = defineCommand({
    meta: { name: "init", description: descriptions.create, hidden: true },
    args: { ...extra.get("create"), ...shared },
    async run({ rawArgs }) {
      process.exitCode = await runtime.run("create", rawArgs)
    }
  })

  return defineCommand({
    meta: {
      name: options.name,
      version: options.version,
      description: options.description ?? `${options.name} project scaffolding`
    },
    subCommands
  })
}

/** Runs one command without citty, returning its exit code. Tests and embedding tools use it. */
export async function runCli(argv: readonly string[], options: CliOptions): Promise<number> {
  const [command, ...rest] = argv
  const runtime = new CliRuntime(options)

  if (command === undefined) {
    runtime.io.stderr(`Usage: ${options.name} <command>. Commands: ${Object.keys(descriptions).join(", ")}.\n`)

    return 2
  }

  return runtime.run(command, rest)
}
