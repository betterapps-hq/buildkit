import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import { shortName } from "../manifest/catalog.js"
import { defineAddon } from "../manifest/define.js"
import type { Answers, CatalogManifest } from "../manifest/types.js"
import { toEnvelope } from "../plan/envelope.js"
import { PlanError } from "../plan/errors.js"
import { readLock } from "../state/files.js"
import {
  addRequest,
  applyFixture,
  applyInMemory,
  fixtureCatalog,
  initRequest,
  planFixture
} from "../testing/fixture.js"
import { selectionFromAnswers } from "./answers.js"
import { checkCatalog, pairwiseAnswers } from "./check.js"
import { describeCatalog, optionQuestions, templateQuestions } from "./questions.js"
import { projectNameProblem, resolveSelection, type Selection } from "./resolve.js"

const base: Selection = { name: "demo", template: "app", target: { id: "web", mode: "ssr" }, addons: {}, declined: [] }

function thrown(run: () => void): PlanError {
  try {
    run()
  } catch (error) {
    if (error instanceof PlanError) {
      return error
    }

    throw error
  }

  throw new Error("expected a PlanError")
}

/** Two ORMs and a hosted backend: Drizzle and Convex conflict with any other ORM, and Prisma says nothing. */
const orms = [
  defineAddon({
    id: "@x/drizzle",
    version: "1.0.0",
    title: "Drizzle",
    description: "Typed SQL",
    provides: { orm: { name: "drizzle" }, database: { dialect: "postgresql" } },
    conflicts: ["provides:orm"],
    contribute: (ctx) => [{ kind: "dependency", name: "drizzle-orm", version: ctx.version("drizzle-orm") }]
  }),
  defineAddon({
    id: "@x/prisma",
    version: "1.0.0",
    title: "Prisma",
    description: "A generated client",
    provides: { orm: { name: "prisma" }, database: { dialect: "postgresql" } },
    contribute: () => [{ kind: "dependency", name: "prisma", version: "6.19.0", dev: true }]
  }),
  defineAddon({
    id: "@x/convex",
    version: "1.0.0",
    title: "Convex",
    description: "A hosted backend",
    provides: { database: { dialect: "convex" } },
    conflicts: ["provides:orm"],
    contribute: () => [{ kind: "dependency", name: "convex", version: "1.29.0" }]
  })
]

function withAddons(catalog: CatalogManifest, ...addons: ReturnType<typeof defineAddon>[]): CatalogManifest {
  return { ...catalog, addons: [...catalog.addons, ...addons] }
}

/**
 * Each value of each question the fixture's app template asks in ssr mode, and the pairs of values of two questions that
 * no answer set has. The values come from what the template asks, so a value no set uses is reported.
 */
function appPairs(catalog: CatalogManifest, sets: Answers[]) {
  const asked = templateQuestions(catalog, "app", "ssr")

  const questions = asked.flatMap((question) =>
    question.pick === "one"
      ? [
          {
            values: [...(question.required ? [] : ["none"]), ...question.choices.map((choice) => choice.id)].map(
              (value) => `${question.id}=${value}`
            ),
            of: (answers: Answers) => `${question.id}=${answers.questions?.[question.id]?.[0] ?? "none"}`
          }
        ]
      : question.choices.map((choice) => ({
          values: [`${choice.id}=false`, `${choice.id}=true`],
          of: (answers: Answers) => `${choice.id}=${answers.questions?.[question.id]?.includes(choice.id) ?? false}`
        }))
  )

  const uncovered: string[] = []

  for (let left = 0; left < questions.length; left++) {
    for (let right = left + 1; right < questions.length; right++) {
      const seen = new Set(sets.map((answers) => `${questions[left]!.of(answers)} & ${questions[right]!.of(answers)}`))

      for (const a of questions[left]!.values) {
        for (const b of questions[right]!.values) {
          if (!seen.has(`${a} & ${b}`)) {
            uncovered.push(`${a} & ${b}`)
          }
        }
      }
    }
  }

  return { values: questions.map((question) => question.values), uncovered }
}

describe("resolveSelection", () => {
  it("rejects unknown add-ons with suggestions, and requires cycles", () => {
    const unknown = thrown(() => resolveSelection(fixtureCatalog(), { ...base, addons: { "@fixture/i18": {} } }))
    expect(unknown.code).toBe("E_UNKNOWN_ADDON")
    expect(unknown.next).toEqual(["@fixture/i18n"])

    const catalog = withAddons(
      fixtureCatalog(),
      defineAddon({
        id: "@x/a",
        version: "1.0.0",
        title: "A",
        description: "",
        requires: ["@x/b"],
        contribute: () => []
      }),
      defineAddon({
        id: "@x/b",
        version: "1.0.0",
        title: "B",
        description: "",
        requires: ["@x/a"],
        contribute: () => []
      })
    )

    expect(thrown(() => resolveSelection(catalog, { ...base, addons: { "@x/a": {} } })).code).toBe("E_CYCLE")
  })

  it("resolves each required add-on once, before its dependents, and reports who pulled it in", () => {
    const result = resolveSelection(fixtureCatalog(), {
      ...base,
      addons: { "@fixture/auth": {}, "@fixture/db-sqlite": {}, "@fixture/i18n": {} }
    })

    if (!result.ok) {
      throw new Error("expected a selection")
    }

    const ids = result.value.addons.map((addon) => addon.manifest.id)
    expect(ids.filter((id) => id === "@fixture/sessions")).toHaveLength(1)
    expect(ids.indexOf("@fixture/sessions")).toBeLessThan(ids.indexOf("@fixture/auth"))
    expect(ids.indexOf("@fixture/db-sqlite")).toBeLessThan(ids.indexOf("@fixture/auth"))
    expect(ids.indexOf("@fixture/i18n")).toBeLessThan(ids.indexOf("@fixture/auth"))
    expect(result.value.addons.find((addon) => addon.manifest.id === "@fixture/sessions")).toMatchObject({
      explicit: false,
      by: ["@fixture/auth"]
    })
  })

  it("asks for a provider a requirement needs, filtered by support", () => {
    const result = resolveSelection(fixtureCatalog(), {
      ...base,
      target: { id: "web", mode: "spa" },
      addons: { "@fixture/auth": {} }
    })

    expect(result).toEqual({
      ok: false,
      issue: {
        kind: "choose-provider",
        capability: "database",
        by: "@fixture/auth",
        candidates: ["@fixture/db-sqlite"]
      }
    })
  })

  it("asks for a provider, and allows one add-on that provides a capability another conflicts with", () => {
    const catalog = withAddons(
      fixtureCatalog(),
      defineAddon({
        id: "@x/translate",
        version: "1.0.0",
        title: "Translate",
        description: "",
        requires: ["provides:i18n"],
        contribute: () => []
      })
    )

    expect(resolveSelection(catalog, { ...base, addons: { "@x/translate": {} } })).toMatchObject({
      ok: false,
      issue: { kind: "choose-provider", candidates: ["@fixture/i18n"] }
    })
    expect(
      resolveSelection(fixtureCatalog(), { ...base, addons: { "@fixture/db-sqlite": {}, "@fixture/db-postgres": {} } })
    ).toMatchObject({
      ok: false,
      issue: { kind: "conflicts", capability: "database" }
    })
  })

  it("reports add-ons that conflict", () => {
    const catalog = withAddons(
      fixtureCatalog(),
      defineAddon({
        id: "@x/no-i18n",
        version: "1.0.0",
        title: "No i18n",
        description: "",
        conflicts: ["@fixture/i18n"],
        contribute: () => []
      })
    )

    expect(resolveSelection(catalog, { ...base, addons: { "@x/no-i18n": {}, "@fixture/i18n": {} } })).toMatchObject({
      ok: false,
      issue: { kind: "conflicts", addon: "@x/no-i18n", other: "@fixture/i18n" }
    })
  })

  it("conflicts by capability both ways, and never with the add-on itself", () => {
    const catalog = withAddons(fixtureCatalog(), ...orms)

    const resolve = (...ids: string[]) =>
      resolveSelection(catalog, { ...base, addons: Object.fromEntries(ids.map((id) => [id, {}])) })

    expect(resolve("@x/drizzle", "@x/prisma")).toEqual({
      ok: false,
      issue: { kind: "conflicts", addon: "@x/drizzle", other: "@x/prisma", capability: "orm" }
    })
    // Only Convex declares it, and Prisma, which provides an ORM, still conflicts with it.
    expect(resolve("@x/prisma", "@x/convex")).toEqual({
      ok: false,
      issue: { kind: "conflicts", addon: "@x/convex", other: "@x/prisma", capability: "orm" }
    })
    expect(resolve("@x/drizzle").ok).toBe(true)
    expect(resolve("@x/prisma", "@fixture/i18n").ok).toBe(true)
    expect(checkCatalog(catalog)).toEqual([])
  })

  it("supports() returning true allows the add-on, and a string is E_UNSUPPORTED", () => {
    expect(resolveSelection(fixtureCatalog(), { ...base, addons: { "@fixture/db-postgres": {} } }).ok).toBe(true)

    const error = thrown(() =>
      resolveSelection(fixtureCatalog(), {
        ...base,
        target: { id: "web", mode: "spa" },
        addons: { "@fixture/db-postgres": {} }
      })
    )

    expect(error.code).toBe("E_UNSUPPORTED")
    expect(error.message).toContain("Postgres needs a server.")
  })

  it("invalid options and unsafe project names are E_INVALID_OPTIONS", () => {
    expect(
      thrown(() => resolveSelection(fixtureCatalog(), { ...base, addons: { "@fixture/ui-fancy": { theme: "neon" } } }))
        .code
    ).toBe("E_INVALID_OPTIONS")
    expect(
      thrown(() => resolveSelection(fixtureCatalog(), { ...base, addons: { "@fixture/storybook": { extra: true } } }))
        .code
    ).toBe("E_INVALID_OPTIONS")
    expect(thrown(() => resolveSelection(fixtureCatalog(), { ...base, name: "../escape" })).code).toBe(
      "E_INVALID_OPTIONS"
    )
    expect(projectNameProblem("My App")).toBeDefined()
    expect(projectNameProblem("node_modules")).toBeDefined()
    expect(projectNameProblem("@scope/app")).toBeUndefined()
    expect(projectNameProblem("-rf")).toBeDefined()
    expect(projectNameProblem("~app")).toBeDefined()
    expect(projectNameProblem("@-x/app")).toBeDefined()
  })

  it("rejects unknown templates, targets and modes", () => {
    expect(thrown(() => resolveSelection(fixtureCatalog(), { ...base, template: "nope" })).code).toBe(
      "E_UNKNOWN_TEMPLATE"
    )
    expect(
      thrown(() => resolveSelection(fixtureCatalog(), { ...base, target: { id: "nope", mode: "ssr" } })).code
    ).toBe("E_UNKNOWN_TARGET")
    expect(thrown(() => resolveSelection(fixtureCatalog(), { ...base, target: { id: "web", mode: "rsc" } })).code).toBe(
      "E_UNKNOWN_TARGET"
    )
  })
})

describe("templates and answers", () => {
  const catalog = fixtureCatalog()

  it("includes required add-ons without a question, and takes defaults for unanswered ones", () => {
    const result = selectionFromAnswers(catalog, { template: "app", mode: "ssr" }, "demo")
    expect(result).toEqual({
      ok: true,
      selection: {
        name: "demo",
        template: "app",
        target: { id: "web", mode: "ssr" },
        addons: { "@fixture/lint": {}, "@fixture/db-sqlite": {}, "@fixture/ui-basic": {}, "@fixture/storybook": {} },
        declined: ["question:localization", "question:telemetry"]
      }
    })
  })

  it("answers questions with short names, records no, and adds extra add-ons", () => {
    const result = selectionFromAnswers(
      catalog,
      {
        template: "app",
        mode: "ssr",
        questions: { database: [], ui: ["ui-fancy"], devtools: [] },
        extra: ["i18n"],
        options: { "ui-fancy": { theme: "dark" } }
      },
      "demo"
    )

    expect(result).toMatchObject({
      ok: true,
      selection: {
        addons: { "@fixture/lint": {}, "@fixture/ui-fancy": { theme: "dark" }, "@fixture/i18n": {} },
        declined: ["question:database", "question:devtools", "question:localization", "question:telemetry"]
      }
    })
  })

  it("asks for the mode when the template has more than one", () => {
    expect(selectionFromAnswers(catalog, { template: "app" }, "demo")).toEqual({
      ok: false,
      issue: { kind: "choose-mode", template: "app", modes: ["ssr", "spa"] }
    })
    expect(selectionFromAnswers(catalog, { template: "bare", questions: { ui: ["ui-basic"] } }, "demo").ok).toBe(true)
  })

  it("a required question with no default and more than one choice needs a decision; one fitting choice is taken", () => {
    expect(selectionFromAnswers(catalog, { template: "bare" }, "demo")).toEqual({
      ok: false,
      issue: {
        kind: "choose",
        template: "bare",
        question: "ui",
        candidates: ["@fixture/ui-basic", "@fixture/ui-fancy"]
      }
    })

    const spaOnly: CatalogManifest = {
      ...catalog,
      templates: catalog.templates.map((template) =>
        template.id === "bare"
          ? { ...template, modes: ["spa"], questions: [{ use: "database", required: true }] }
          : template
      )
    }

    expect(selectionFromAnswers(spaOnly, { template: "bare" }, "demo")).toMatchObject({
      ok: true,
      selection: { addons: { "@fixture/db-sqlite": {} } }
    })
  })

  it("rejects answers that don't fit the template", () => {
    expect(thrown(() => selectionFromAnswers(catalog, { template: "nope" }, "demo")).code).toBe("E_UNKNOWN_TEMPLATE")
    expect(thrown(() => selectionFromAnswers(catalog, { template: "app", mode: "rsc" }, "demo")).code).toBe("E_USAGE")
    expect(
      thrown(() => selectionFromAnswers(catalog, { template: "app", mode: "ssr", questions: { ui: [] } }, "demo")).code
    ).toBe("E_USAGE")
    expect(
      thrown(() =>
        selectionFromAnswers(catalog, { template: "app", mode: "ssr", questions: { database: ["ui-fancy"] } }, "demo")
      ).code
    ).toBe("E_USAGE")
    expect(
      thrown(() => selectionFromAnswers(catalog, { template: "app", mode: "ssr", questions: { nope: ["x"] } }, "demo"))
        .code
    ).toBe("E_USAGE")
    expect(
      thrown(() =>
        selectionFromAnswers(
          catalog,
          { template: "app", mode: "ssr", questions: { ui: ["ui-basic", "ui-fancy"] } },
          "demo"
        )
      ).message
    ).toBe("UI kit takes one answer, not @fixture/ui-basic, @fixture/ui-fancy.")
    expect(
      thrown(() =>
        selectionFromAnswers(
          catalog,
          { template: "app", mode: "ssr", options: { "@fixture/i18n": { locales: [] } } },
          "demo"
        )
      ).code
    ).toBe("E_USAGE")
  })
})

describe("plan decisions", () => {
  it("re-adding an installed add-on is unchanged, and answering a declined question isn't a replace", async () => {
    const files = await applyFixture({}, initRequest({ questions: { database: [] } }))
    expect((await planFixture(files, addRequest(["storybook"]))).status).toBe("unchanged")
    const filled = await planFixture(files, addRequest(["db-postgres"]))
    expect(filled.status).toBe("planned")
    expect(filled.operations.find((operation) => operation.path === "fixture.jsonc")?.content).not.toContain(
      "question:database"
    )
  })

  it("every needs-decision choice carries a complete request that resolves without asking again", async () => {
    const files = await applyFixture({}, initRequest())
    const taken = await planFixture(files, addRequest(["db-postgres"]))
    expect(taken.status).toBe("needs-decision")

    for (const choice of taken.decisions.flatMap((decision) => decision.choices)) {
      expect((await planFixture(files, choice.request)).status).toBe("planned")
    }

    const mode = await planFixture({}, { intent: { command: "init", answers: { template: "app", name: "demo" } } })
    expect(mode.decisions[0]?.choices.map((choice) => choice.id)).toEqual(["ssr", "spa"])

    for (const choice of mode.decisions[0]?.choices ?? []) {
      expect((await planFixture({}, choice.request)).status).toBe("planned")
    }

    const slotless = await applyFixture({}, initRequest({ questions: { database: [] } }))
    const question = await planFixture(slotless, addRequest(["database"]))
    expect(question.decisions[0]).toMatchObject({ id: "question:database", message: "Which database?" })

    for (const choice of question.decisions[0]?.choices ?? []) {
      expect(choice.request.intent).toMatchObject({ command: "add", addons: [choice.id] })
      expect((await planFixture(slotless, choice.request)).status).toBe("planned")
    }

    const auth = await planFixture(slotless, addRequest(["auth"]))
    expect(auth.decisions[0]?.message).toBe("Auth needs a database. Which database?")
  })

  it("swaps an add-on that conflicts by capability, through the decision's argv", async () => {
    const catalog = withAddons(fixtureCatalog(), ...orms)

    const files = await applyFixture({}, initRequest({ questions: { database: [] }, extra: ["@x/drizzle"] }), {
      catalog
    })

    const swap = await planFixture(files, addRequest(["prisma"]), { catalog })
    expect(swap.decisions).toEqual([
      {
        id: "conflicts:@x/drizzle",
        message: "Drizzle is your orm. Replace it with Prisma?",
        choices: [
          {
            id: "replace",
            label: "Replace Drizzle",
            request: { intent: { command: "add", addons: ["@x/prisma"], replace: ["@x/drizzle"], options: {} } }
          }
        ]
      }
    ])
    const [choice] = toEnvelope(swap, { product: "fixture", catalog }).decisions?.[0]?.choices ?? []
    expect(choice?.argv).toEqual(["fixture", "add", "prisma", "--replace", "drizzle"])
    const swapped = await applyFixture(files, choice!.request, { catalog })
    const config = swapped["fixture.jsonc"] ?? ""
    expect([config.includes("@x/prisma"), config.includes("@x/drizzle")]).toEqual([true, false])
    expect(JSON.parse(swapped["package.json"] ?? "{}").devDependencies).toMatchObject({ prisma: "6.19.0" })

    // Convex declares the conflict, and doesn't provide an ORM itself.
    const convex = await applyFixture({}, initRequest({ questions: { database: [] }, extra: ["@x/convex"] }), {
      catalog
    })

    const fromConvex = await planFixture(convex, addRequest(["prisma"]), { catalog })
    expect(fromConvex.decisions[0]?.message).toBe(
      "Convex can't be used with an add-on that provides orm. Replace it with Prisma?"
    )
    expect((await planFixture(convex, fromConvex.decisions[0]!.choices[0]!.request, { catalog })).status).toBe(
      "planned"
    )

    // An upgrade stays an upgrade, so it says how to swap instead of offering it.
    const upgrade = await planFixture(files, { intent: { command: "upgrade", addons: ["prisma"] } }, { catalog })
    expect(upgrade.decisions[0]).toMatchObject({
      message: "Drizzle is your orm. To replace it with Prisma, run add prisma --replace drizzle.",
      choices: []
    })

    // Where two add-ons share a short name, the command names the one meant by its id.
    const twin = defineAddon({ ...orms[1]!, id: "@y/prisma" })

    const twins = await planFixture(
      files,
      { intent: { command: "sync", addons: ["@x/prisma"] } },
      {
        catalog: withAddons(catalog, twin)
      }
    )

    expect(twins.decisions[0]?.message).toBe(
      "Drizzle is your orm. To replace it with Prisma, run add @x/prisma --replace drizzle."
    )

    // Drizzle pulled in by another add-on goes with that add-on, so it can't be swapped on its own.
    const needsDrizzle = defineAddon({
      id: "@x/migrations",
      version: "1.0.0",
      title: "Migrations",
      description: "",
      requires: ["@x/drizzle"],
      contribute: () => []
    })

    const withMigrations = withAddons(catalog, needsDrizzle)

    const pulled = await applyFixture({}, initRequest({ questions: { database: [] }, extra: ["@x/migrations"] }), {
      catalog: withMigrations
    })

    expect((await planFixture(pulled, addRequest(["prisma"]), { catalog: withMigrations })).decisions[0]).toMatchObject(
      {
        message: "Drizzle is your orm. Migrations needs it, so it can't be replaced with Prisma.",
        choices: []
      }
    )

    // Chosen as well, Drizzle would still be pulled back in by Migrations.
    const chosen = await applyFixture(
      {},
      initRequest({ questions: { database: [] }, extra: ["@x/migrations", "@x/drizzle"] }),
      {
        catalog: withMigrations
      }
    )

    expect((await planFixture(chosen, addRequest(["prisma"]), { catalog: withMigrations })).decisions[0]).toMatchObject(
      {
        message: "Drizzle is your orm. Migrations needs it, so it can't be replaced with Prisma.",
        choices: []
      }
    )

    // Asked for together, neither is installed, so there's nothing to swap.
    const both = await planFixture(
      {},
      initRequest({ questions: { database: [] }, extra: ["@x/drizzle", "@x/prisma"] }),
      {
        catalog
      }
    )

    expect(both.decisions[0]).toMatchObject({
      message: "Drizzle can't be used with Prisma. Remove one of them from the config.",
      choices: []
    })
  })

  it("validates --replace: unknown add-ons get suggestions, and the target can't change", async () => {
    const files = await applyFixture({}, initRequest())
    expect((await planFixture(files, addRequest(["db-postgres"], ["db-sqlit"]))).error).toMatchObject({
      code: "E_UNKNOWN_ADDON",
      next: ["@fixture/db-sqlite"]
    })
    expect((await planFixture(files, addRequest(["db-postgres"], ["web"]))).error?.code).toBe("E_USAGE")
    expect((await planFixture(files, addRequest(["i18n"], ["db-sqlite"]))).error?.code).toBe("E_USAGE")
    expect((await planFixture(files, addRequest(["db-postgres"], ["i18n"]))).error?.code).toBe("E_USAGE")
  })

  it("offers only supported alternatives in a decision", async () => {
    const files = await applyFixture({}, initRequest({ mode: "spa", questions: { database: [] } }))
    const decision = await planFixture(files, addRequest(["database"]))
    expect(decision.status).toBe("planned")
    expect(decision.operations.map((operation) => operation.path)).toContain("src/db/schema.ts")
  })
})

describe("questions and catalog CI", () => {
  const catalog = fixtureCatalog()

  it("describes each template's questions in wizard order", () => {
    const spa = templateQuestions(catalog, "app", "spa")
    expect(
      spa.map((question) => [
        question.id,
        question.question,
        question.required,
        question.default,
        question.choices.map((choice) => choice.id)
      ])
    ).toEqual([
      ["database", "Add a database?", false, ["@fixture/db-sqlite"], ["@fixture/db-sqlite"]],
      ["ui", "Add a UI kit?", true, ["@fixture/ui-basic"], ["@fixture/ui-basic", "@fixture/ui-fancy"]],
      ["localization", "Add localization?", false, [], ["@fixture/i18n"]],
      ["devtools", "Add developer tools?", false, ["@fixture/storybook"], ["@fixture/storybook"]],
      ["telemetry", "Add telemetry?", false, [], ["@fixture/sentry"]]
    ])
    const description = describeCatalog(catalog)
    const [app] = description.templates
    expect(app?.required.map((choice) => choice.id)).toEqual(["@fixture/lint"])
    expect(Object.keys(app?.questionsByMode ?? {})).toEqual(["ssr", "spa"])
    expect(app?.gallery.stack).toEqual(["Lint", "SQLite", "Basic UI", "Storybook"])
    expect(description.addons.find((addon) => addon.id === "@fixture/i18n")?.ask).toEqual([
      {
        addon: "@fixture/i18n",
        key: "locales",
        title: "Locales",
        schema: expect.objectContaining({ type: "array" }),
        default: ["en"]
      }
    ])
    expect(description.addons.find((addon) => addon.id === "@fixture/auth")).toMatchObject({
      provides: [],
      requires: ["@fixture/sessions", "provides:database"],
      conflicts: []
    })
    expect(description.presets).toEqual([
      {
        id: "saas",
        title: "SaaS",
        template: "app",
        answers: {
          template: "app",
          mode: "ssr",
          questions: { database: ["@fixture/db-postgres"], localization: ["@fixture/i18n"] }
        }
      }
    ])
  })

  it("passes for the fixture catalog, including every pair of answers", () => {
    expect(checkCatalog(catalog, { matrix: true })).toEqual([])
    expect(pairwiseAnswers(catalog, "nope", "ssr")).toEqual([])
  })

  it("covers every pair of values of every two questions, in few answer sets", () => {
    const sets = pairwiseAnswers(catalog, "app", "ssr")
    const { values, uncovered } = appPairs(catalog, sets)
    expect(values.filter((choices) => choices.length < 2)).toEqual([])
    expect(uncovered).toEqual([])

    // Every pair with the rest at their defaults would need a set per pair of values; a covering array needs far fewer.
    const pairs = values.reduce(
      (total, left, index) =>
        total + values.slice(index + 1).reduce((sum, right) => sum + left.length * right.length, 0),
      0
    )

    expect(sets.length).toBeLessThan(pairs / 2)
    expect(pairwiseAnswers(catalog, "app", "ssr")).toEqual(sets)
  })

  it("leaves out answer sets the engine turns down, and still covers every pair that can be planned", () => {
    const conflicting: CatalogManifest = {
      ...catalog,
      addons: catalog.addons.map((addon) =>
        addon.id === "@fixture/i18n" ? { ...addon, conflicts: ["@fixture/sentry"] } : addon
      )
    }

    const sets = pairwiseAnswers(conflicting, "app", "ssr")

    const turnedDown = sets.filter((answers) => {
      const selection = selectionFromAnswers(conflicting, answers, "demo")

      return !selection.ok || !resolveSelection(conflicting, selection.selection).ok
    })

    expect(turnedDown).toEqual([])
    expect(appPairs(conflicting, sets).uncovered).toEqual(["localization=@fixture/i18n & telemetry=@fixture/sentry"])
  })

  it("plans the other questions when a required question has no add-on for the mode", () => {
    const lonely: CatalogManifest = {
      ...catalog,
      templates: [
        ...catalog.templates,
        {
          id: "lonely",
          title: "Lonely",
          description: "A template whose question has nothing to offer",
          target: "web",
          questions: [
            {
              id: "localization",
              title: "Localization",
              question: "Add localization?",
              pick: "one",
              choices: ["@fixture/i18n"]
            },
            { id: "nothing", title: "Nothing", required: true, pick: "one", choices: [] }
          ]
        }
      ]
    }

    expect(pairwiseAnswers(lonely, "lonely", "ssr").map(({ questions }) => questions)).toEqual([
      { localization: [] },
      { localization: ["@fixture/i18n"] }
    ])
  })

  it("reports broken references, defaults and options", () => {
    const broken: CatalogManifest = {
      ...catalog,
      version: "one",
      targets: [
        ...catalog.targets,
        {
          ...(catalog.targets[0] ?? { id: "", title: "", description: "", family: "", modes: [], base: () => [] }),
          id: "empty",
          modes: [{ id: "x", title: "X", renderModel: "spa", facets: ["webgl"] }]
        }
      ],
      addons: [
        ...catalog.addons,
        defineAddon({
          id: "@x/bad",
          version: "1.0.0",
          title: "Bad",
          description: "",
          requires: ["@x/missing", "provides:nope"],
          conflicts: ["@x/gone", "provides:nothing", "provides:i18n"],
          after: ["provides:i18n"],
          ask: ["missing"],
          options: z.object({ needed: z.string() }),
          migrations: [
            { version: "9.0.0", kind: "agent", description: "" },
            { version: "x", kind: "agent", description: "" }
          ],
          contribute: () => []
        }),
        defineAddon({ id: "@x/bad", version: "1", title: "Duplicate", description: "", contribute: () => [] })
      ],
      templates: [
        ...catalog.templates,
        {
          id: "broken",
          title: "Broken",
          description: "",
          target: "web",
          modes: ["ssr", "rsc"],
          required: ["@x/missing"]
        },
        { id: "unasked", title: "Unasked", description: "", target: "web", questions: ["nope"] },
        {
          id: "needs-default",
          title: "Needs default",
          description: "",
          target: "web",
          required: ["@x/bad"],
          questions: [{ use: "database", default: "@fixture/db-postgres" }]
        },
        {
          id: "odd",
          title: "Odd",
          description: "",
          target: "web",
          questions: [
            { use: "database", default: "@fixture/i18n" },
            { id: "Bad Id", title: "Bad", required: true, pick: "one", choices: ["@fixture/i18n"] },
            { id: "json", title: "Flag", question: "Add it?", pick: "one", choices: ["@fixture/sentry"] },
            { id: "none", title: "None", required: true, pick: "one", choices: [] },
            { id: "ui", title: "Mine", question: "Mine?", pick: "one", choices: ["@x/nowhere"] }
          ]
        },
        { id: "lost", title: "Lost", description: "", target: "nowhere" },
        { id: "orphaned", title: "Orphaned", description: "", extends: "missing" }
      ],
      presets: [{ id: "orphan", title: "Orphan", answers: { template: "nope" } }]
    }

    const problems = checkCatalog(broken)

    const missing = [
      "refers to @x/gone, which isn't in the catalog",
      "uses provides:i18n in after, which takes add-on ids only",
      "refers to provides:nothing, and no add-on provides it",
      "isn't a semantic version",
      "More than one add-on has the id @x/bad",
      "uses facet webgl",
      "refers to @x/missing",
      "refers to provides:nope",
      "asks about option missing",
      "newer than the add-on",
      "offers mode rsc",
      "names required add-on @x/missing",
      "Template unasked asks question nope, which isn't in the catalog.",
      "every option needs a default",
      "doesn't support web/spa",
      "Template odd question database defaults to @fixture/i18n, which it doesn't offer.",
      "Template odd question Bad Id needs an id of lowercase letters, digits and hyphens.",
      "Template odd question json has the id of one of the CLI's own flags.",
      "Template odd question none has no choices.",
      "Template odd question ui offers @x/nowhere, which isn't in the catalog.",
      "Template odd defines question ui, which is a catalog question's id.",
      "uses target nowhere",
      "Template orphaned extends missing, which isn't in the catalog.",
      "Preset orphan"
    ].filter((expected) => !problems.some((problem) => problem.includes(expected)))

    expect(missing).toEqual([])
  })

  it("reports env help links that aren't https", () => {
    expect(checkCatalog(fixtureCatalog(), { matrix: true })).toEqual([])
    const catalog = fixtureCatalog()
    const sentry = catalog.addons.find((addon) => addon.id === "@fixture/sentry")!
    const contribute = sentry.contribute

    for (const help of ["http://sentry.example/keys", "the Sentry dashboard"]) {
      sentry.contribute = (ctx) =>
        contribute(ctx).map((contribution) => (contribution.kind === "env" ? { ...contribution, help } : contribution))
      expect(checkCatalog(catalog, { matrix: true })).toEqual([
        `SENTRY_DSN has the help link "${help}", which isn't an https URL.`
      ])
    }
  })

  it("reports pins that aren't ranges, and add-ons whose packages the pins don't fit", () => {
    const written = (id: string, packages: Record<string, string>) =>
      defineAddon({ id, version: "1.0.0", title: id, description: "", packages, contribute: () => [] })

    const pinned: CatalogManifest = {
      ...withAddons(
        catalog,
        written("@x/fits", { react: "^19", "drizzle-orm": ">=0.45 <1", vite: "*" }),
        written("@x/too-new", { react: ">=19.4 <20" }),
        written("@x/unpinned", { zod: "^4" }),
        written("@x/not-a-range", { react: "nineteen" }),
        written("@x/unbounded", { pg: "^8" }),
        written("@x/empty", { "@lingui/core": "^6" })
      ),
      // SAFETY: a catalog written in JavaScript can hold a range style outside the type, which is what the check catches.
      range: "sideways" as CatalogManifest["range"],
      versions: { ...catalog.versions, vite: "latest", pg: "<9", "@lingui/core": ">=7 <6" }
    }

    expect(checkCatalog(pinned)).toEqual([
      `Catalog range "sideways" isn't exact, caret or tilde.`,
      `The pin for vite, "latest", isn't an exact version or a version range.`,
      '@x/too-new is written for react >=19.4 <20, but the pin "19.3.1" allows 19.3.1.',
      "@x/unpinned is written for zod, which the catalog doesn't pin.",
      `@x/not-a-range is written for react "nineteen", which isn't a version range.`,
      '@x/unbounded is written for pg ^8, but the pin "<9" allows 0.0.0.',
      '@x/empty is written for @lingui/core ^6, but the pin ">=7 <6" allows no version.'
    ])
    expect(checkCatalog({ ...catalog, range: "caret", versions: { ...catalog.versions, react: "~19.3.1" } })).toEqual(
      []
    )
  })

  it("lists the options an add-on asks about", () => {
    const fancy = catalog.addons.find((addon) => addon.id === "@fixture/ui-fancy")
    expect(fancy && optionQuestions(fancy)).toEqual([
      {
        addon: "@fixture/ui-fancy",
        key: "theme",
        title: "Theme",
        schema: expect.objectContaining({ enum: ["light", "dark"] }),
        default: "light"
      }
    ])
  })
})

describe("combination add-ons", () => {
  const glue = (id: string, title: string, joins: string[]) =>
    defineAddon({
      id,
      version: "1.0.0",
      title,
      description: "",
      joins,
      contribute: () => [
        { kind: "file", path: `src/glue/${shortName(id)}.ts`, content: "export {}\n", ownership: "seed" }
      ]
    })

  const combinations = [
    glue("@x/auth-sqlite", "Auth tables for SQLite", ["@fixture/auth", "@fixture/db-sqlite"]),
    glue("@x/auth-postgres", "Auth tables for Postgres", ["@fixture/auth", "@fixture/db-postgres"]),
    // It joins another combination, so it's selected only once that one is.
    glue("@x/auth-i18n", "Translated auth", ["@x/auth-sqlite", "provides:i18n"])
  ]

  const catalog = withAddons(fixtureCatalog(), ...combinations)
  const lockOf = (files: Record<string, string>) => readLock(".fixture/lock.json", files[".fixture/lock.json"] ?? "")

  it("are selected when every reference matches, until nothing changes, after what they join", () => {
    const resolve = (...ids: string[]) => {
      const result = resolveSelection(catalog, { ...base, addons: Object.fromEntries(ids.map((id) => [id, {}])) })

      if (!result.ok) {
        throw new Error(result.issue.kind)
      }

      return result.value.addons.map(({ manifest, explicit, by }) => ({ id: manifest.id, explicit, by }))
    }

    const sqlite = resolve("@fixture/auth", "@fixture/db-sqlite")
    expect(sqlite.find((addon) => addon.id.startsWith("@x/"))).toEqual({
      id: "@x/auth-sqlite",
      explicit: false,
      by: ["@fixture/auth", "@fixture/db-sqlite"]
    })
    expect(sqlite.map((addon) => addon.id).filter((id) => id.startsWith("@x/"))).toEqual(["@x/auth-sqlite"])
    const ids = resolve("@fixture/auth", "@fixture/db-sqlite", "@fixture/i18n").map((addon) => addon.id)
    expect(ids.indexOf("@x/auth-sqlite")).toBeGreaterThan(
      Math.max(ids.indexOf("@fixture/auth"), ids.indexOf("@fixture/db-sqlite"))
    )
    expect(ids.indexOf("@x/auth-i18n")).toBeGreaterThan(
      Math.max(ids.indexOf("@x/auth-sqlite"), ids.indexOf("@fixture/i18n"))
    )

    // A combination is part of the selection its conflicts and requirements are checked against.
    const strict = withAddons(
      catalog,
      { ...glue("@x/auth-ui", "Auth screens", ["@fixture/auth", "@fixture/ui-basic"]), conflicts: ["@fixture/i18n"] },
      { ...glue("@x/adapter", "Adapter", ["@fixture/auth", "@fixture/db-sqlite"]), provides: { adapter: {} } },
      defineAddon({
        id: "@x/consumer",
        version: "1.0.0",
        title: "Consumer",
        description: "",
        requires: ["provides:adapter"],
        contribute: () => []
      })
    )

    const strictly = (...ids: string[]) =>
      resolveSelection(strict, { ...base, addons: Object.fromEntries(ids.map((id) => [id, {}])) })

    expect(strictly("@fixture/auth", "@fixture/ui-basic", "@fixture/i18n", "@fixture/db-sqlite")).toMatchObject({
      ok: false,
      issue: { kind: "conflicts", addon: "@x/auth-ui", other: "@fixture/i18n" }
    })
    expect(strictly("@fixture/auth", "@fixture/db-sqlite", "@x/consumer").ok).toBe(true)
    // Without what it joins, the combination isn't offered as the provider, since it can't be added by name.
    expect(strictly("@fixture/db-sqlite", "@x/consumer")).toMatchObject({
      ok: false,
      issue: { kind: "choose-provider", capability: "adapter", candidates: [] }
    })

    // Named in a selection, a combination still needs what it joins.
    expect(resolve("@x/auth-postgres", "@fixture/db-sqlite").map((addon) => addon.id)).toEqual(["@fixture/db-sqlite"])
  })

  it("are added and removed with the selection, and the lock records what they join", async () => {
    const files = await applyFixture({}, initRequest(), { catalog })
    const added = await planFixture(files, addRequest(["auth"]), { catalog })
    expect(added.pulled).toContainEqual({
      id: "@x/auth-sqlite",
      by: ["@fixture/auth", "@fixture/db-sqlite"],
      joins: true
    })
    const withAuth = applyInMemory(files, added)
    expect(lockOf(withAuth).addons["@x/auth-sqlite"]).toMatchObject({
      explicit: false,
      by: ["@fixture/auth", "@fixture/db-sqlite"]
    })
    expect(withAuth["fixture.jsonc"]).not.toContain("@x/auth-sqlite")
    expect(withAuth["src/glue/auth-sqlite.ts"]).toBe("export {}\n")

    const replaced = await applyFixture(withAuth, addRequest(["db-postgres"], ["db-sqlite"]), { catalog })
    expect(Object.keys(lockOf(replaced).addons).filter((id) => id.startsWith("@x/"))).toEqual(["@x/auth-postgres"])
    expect([replaced["src/glue/auth-sqlite.ts"], replaced["src/glue/auth-postgres.ts"]]).toEqual([
      undefined,
      "export {}\n"
    ])

    // A catalog upgrade that brings a combination adds it to a project that has what it joins.
    const before = await applyFixture(await applyFixture({}, initRequest()), addRequest(["auth"]))
    const v2 = withAddons(fixtureCatalog(2), ...combinations)
    const catalogs = (version: string) => (version === "1.0.0" ? fixtureCatalog(1) : undefined)
    const upgraded = await planFixture(before, { intent: { command: "upgrade" } }, { catalog: v2, catalogs })
    expect(upgraded.pulled.map((pulled) => pulled.id)).toEqual(["@x/auth-sqlite"])
    expect(upgraded.operations.map((operation) => operation.path)).toContain("src/glue/auth-sqlite.ts")
  })

  it("can't be asked for by name", async () => {
    const files = await applyFixture({}, initRequest(), { catalog })
    expect((await planFixture(files, addRequest(["auth-sqlite"]), { catalog })).error).toMatchObject({
      code: "E_USAGE",
      message: "Auth tables for SQLite is added with Auth and SQLite."
    })
    expect((await planFixture({}, initRequest({ extra: ["@x/auth-i18n"] }), { catalog })).error).toMatchObject({
      code: "E_USAGE",
      message: "Translated auth is added with Auth tables for SQLite and an add-on that provides i18n."
    })
    const sync = { intent: { command: "sync" as const, addons: ["@x/auth-postgres"] } }
    expect((await planFixture(files, sync, { catalog })).error?.code).toBe("E_USAGE")
  })

  it("are checked: two references that exist, no requires or options, and never named", () => {
    expect(checkCatalog(catalog, { matrix: true })).toEqual([])
    const [app] = catalog.templates

    const broken: CatalogManifest = {
      ...withAddons(
        catalog,
        { ...glue("@x/lonely", "Lonely", ["@fixture/auth"]), requires: ["@fixture/sessions"] },
        glue("@x/dangling", "Dangling", ["@x/missing", "provides:nothing"]),
        { ...glue("@x/optioned", "Optioned", ["@fixture/auth", "@fixture/i18n"]), options: z.object({}) }
      ),
      templates: [{ ...app!, required: [...(app?.required ?? []), "@x/auth-sqlite"] }],
      presets: [{ id: "glued", title: "Glued", answers: { template: "app", extra: ["@x/auth-postgres"] } }]
    }

    const problems = checkCatalog(broken)

    const missing = [
      "@x/lonely is a combination add-on, so it joins at least two add-ons.",
      "@x/lonely is a combination add-on, so it can't have requires or options.",
      "@x/optioned is a combination add-on, so it can't have requires or options.",
      "@x/dangling refers to @x/missing, which isn't in the catalog.",
      "@x/dangling refers to provides:nothing, and no add-on provides it.",
      "Template app names @x/auth-sqlite, a combination add-on, which is added with what it joins.",
      "Preset glued names @x/auth-postgres, a combination add-on, which is added with what it joins."
    ].filter((expected) => !problems.includes(expected))

    expect(missing).toEqual([])
  })
})
