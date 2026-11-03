import { describe, expect, it } from "vite-plus/test"
import { cancelled } from "../cli/prompter.js"
import { runWizard, emptyAnswers } from "../cli/wizard.js"
import { expandTemplate, findAddon, lookupAddon } from "../manifest/catalog.js"
import { defineAddon } from "../manifest/define.js"
import type { Answers, CatalogManifest, TemplateManifest } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { plan } from "../plan/plan.js"
import { memoryTree } from "../plan/tree.js"
import type { PlanRequest } from "../plan/types.js"
import { defineSettings } from "../state/settings.js"
import { exampleCatalog } from "../testing/example.js"
import { scriptedPrompter } from "../testing/prompter.js"
import { selectionFromAnswers } from "./answers.js"
import { checkCatalog } from "./check.js"
import { availableChoices, describeCatalog, describeTemplate, templateQuestions } from "./questions.js"
import { resolveSelection } from "./resolve.js"

const settings = defineSettings({ product: "acme" })

function thrown(run: () => unknown): PlanError {
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

function withTemplates(catalog: CatalogManifest, ...templates: TemplateManifest[]): CatalogManifest {
  return { ...catalog, templates: [...catalog.templates, ...templates] }
}

/** The add-on ids a template's answers resolve to, in contribution order. */
function resolved(catalog: CatalogManifest, answers: Answers): string[] {
  const selection = selectionFromAnswers(catalog, answers, "demo")
  if (!selection.ok) {
    throw new Error(`expected a selection, got ${selection.issue.kind}`)
  }
  const result = resolveSelection(catalog, selection.selection)
  if (!result.ok) {
    throw new Error(`expected a resolution, got ${result.issue.kind}`)
  }
  return result.value.addons.map((addon) => addon.manifest.id)
}

function init(answers: Partial<Answers> = {}): PlanRequest {
  return { intent: { command: "init", answers: { template: "saas", name: "demo", ...answers } } }
}

describe("templates on questions", () => {
  const catalog = exampleCatalog()

  it("the example catalog has no problems, including every pair of answers", () => {
    expect(checkCatalog(catalog, { matrix: true })).toEqual([])
  })

  it("asks a parent's questions in order, and a child's replace them in place", () => {
    const ids = (template: string) => templateQuestions(catalog, template, "spa").map((question) => question.id)
    expect(ids("vite-web")).toEqual(["localization", "database", "auth", "telemetry", "devtools"])
    expect(ids("saas")).toEqual(["localization", "database", "auth", "telemetry"])
    const saas = templateQuestions(catalog, "saas", "spa")
    expect(saas.map((question) => [question.id, question.required, question.default])).toEqual([
      ["localization", false, ["@acme/lingui"]],
      ["database", true, ["@acme/drizzle"]],
      ["auth", true, ["@acme/better-auth"]],
      ["telemetry", false, ["@acme/posthog"]]
    ])
    expect(saas[1]?.choices).toEqual([
      { id: "@acme/drizzle", label: "Drizzle", hint: "Typed SQL, runs anywhere" },
      { id: "@acme/prisma", label: "Prisma", hint: "Schema first, generated client" },
      { id: "@acme/convex", label: "Convex", hint: "Hosted, no SQL to write" }
    ])
    // A choice without a hint shows the add-on's description.
    expect(saas[2]?.choices[1]).toEqual({ id: "@acme/clerk", label: "Clerk", hint: "Hosted sign-in" })
    expect(expandTemplate(catalog, "saas")).toMatchObject({
      target: "vite-react",
      extends: "vite-web",
      modes: ["spa"],
      required: ["npm:vite-plus", "npm:vitest", "npm:zod"]
    })
    // The gallery's stack is what every default answer gets, without combinations, and gallery isn't inherited.
    expect(describeTemplate(catalog, "saas").gallery).toEqual({
      tags: ["saas", "auth", "database"],
      links: { demo: "https://saas.acme.dev" },
      stack: ["Vite+", "Vitest", "zod", "Lingui", "Drizzle", "Better Auth", "PostHog"]
    })
  })

  it("leaves out what omit names, and reports extends cycles and missing parents", () => {
    const leaner = withTemplates(catalog, {
      id: "lean",
      title: "Lean",
      description: "",
      extends: "vite-web",
      omit: ["telemetry", "npm:vitest"]
    })
    expect(expandTemplate(leaner, "lean")).toMatchObject({ required: ["npm:vite-plus"] })
    expect(expandTemplate(leaner, "lean")?.questions.map((question) => question.id)).toEqual([
      "localization",
      "database",
      "auth",
      "devtools"
    ])
    const cyclic = withTemplates(
      catalog,
      { id: "a", title: "A", description: "", extends: "b" },
      { id: "b", title: "B", description: "", extends: "a" }
    )
    expect(thrown(() => expandTemplate(cyclic, "a"))).toMatchObject({
      code: "E_INVALID_CATALOG",
      message: "Templates extend each other in a cycle: a, b, a."
    })
    expect(checkCatalog(cyclic)).toContain("Templates extend each other in a cycle: a, b, a.")
    const omitting = withTemplates(catalog, {
      id: "odd",
      title: "Odd",
      description: "",
      extends: "saas",
      omit: ["devtools"]
    })
    expect(checkCatalog(omitting)).toEqual(["Template odd omits devtools, which saas doesn't have."])
  })

  it("makes a bare add-on for each package a template names, at the catalog's pin", async () => {
    expect(lookupAddon(catalog, "zod")).toEqual({ id: "npm:zod" })
    expect(lookupAddon(catalog, "@playwright/test")).toEqual({ id: "npm:@playwright/test" })
    expect(findAddon(catalog, "npm:vite-plus")).toMatchObject({ title: "Vite+", version: "0.0.0", description: "" })
    const planned = await plan({ catalog, settings, tree: memoryTree({}), request: init() })
    expect(planned.status).toBe("planned")
    const manifest = JSON.parse(
      planned.operations.find((operation) => operation.path === "package.json")?.content ?? "{}"
    )
    // A caret catalog writes exact pins with ^, and a pin that's a range as it is.
    expect(manifest.dependencies).toMatchObject({ zod: "^4.1.0", "drizzle-orm": "~0.45.4", "better-auth": "^1.7.9" })
    expect(manifest.devDependencies).toMatchObject({ "vite-plus": "^0.1.0", vitest: "^4.0.8" })
  })
})

describe("the catalog description", () => {
  it("describes templates, their questions per mode, and the add-ons' rules, for other doors", () => {
    const description = describeCatalog(exampleCatalog())
    expect(description.catalog).toEqual({ id: "@acme/catalog", version: "2.0.0" })
    const [web, saas] = description.templates
    expect(web).toMatchObject({
      id: "vite-web",
      title: "Web app",
      modes: [{ id: "spa", title: "Single-page" }],
      required: [
        { id: "npm:vite-plus", label: "Vite+" },
        { id: "npm:vitest", label: "Vitest" }
      ],
      gallery: { tags: ["react", "vite"], image: "gallery/vite-web.png", stack: ["Vite+", "Vitest", "Lingui"] }
    })
    expect(web?.extends).toBeUndefined()
    expect(saas?.extends).toBe("vite-web")
    expect(saas?.questionsByMode.spa?.find((question) => question.id === "telemetry")).toEqual({
      id: "telemetry",
      title: "Telemetry",
      question: "Add telemetry?",
      choose: "Which ones?",
      pick: "many",
      required: false,
      default: ["@acme/posthog"],
      choices: [
        { id: "@acme/sentry", label: "Sentry", hint: "Errors and performance" },
        { id: "@acme/posthog", label: "PostHog", hint: "Product analytics" }
      ]
    })
    const addon = (id: string) => description.addons.find((candidate) => candidate.id === id)
    expect(addon("@acme/drizzle")).toMatchObject({
      provides: ["orm", "database"],
      requires: [],
      conflicts: ["provides:orm"]
    })
    expect(addon("@acme/better-auth")).toMatchObject({ requires: ["provides:orm"], conflicts: ["provides:auth"] })
    expect(addon("@acme/better-auth-drizzle")?.joins).toEqual(["@acme/better-auth", "@acme/drizzle"])
    expect(addon("@acme/drizzle")?.joins).toBeUndefined()
    expect(addon("npm:zod")).toMatchObject({ title: "zod", version: "0.0.0", provides: [] })
    expect(description.presets.map((preset) => preset.id)).toEqual(["saas-prisma"])
    // The description is plain data: structuredClone throws on functions.
    expect(structuredClone(description)).toEqual(description)
  })
})

describe("which choices are available", () => {
  const catalog = exampleCatalog()
  const auth = (questions: Answers["questions"]) =>
    availableChoices(catalog, { template: "vite-web", questions }, "auth").choices.map((choice) => [
      choice.id,
      choice.disabled
    ])

  it("follows the add-ons' rules from the answers before the question", () => {
    expect(auth({ database: ["@acme/convex"] })).toEqual([
      ["@acme/better-auth", "Needs Drizzle or Prisma"],
      ["@acme/clerk", undefined]
    ])
    expect(auth({ database: [] })).toEqual([
      ["@acme/better-auth", "Needs Drizzle or Prisma"],
      ["@acme/clerk", undefined]
    ])
    expect(auth({ database: ["@acme/drizzle"] })).toEqual([
      ["@acme/better-auth", undefined],
      ["@acme/clerk", undefined]
    ])
    // Later answers don't count, and the question is still asked: Clerk is available.
    expect(availableChoices(catalog, { template: "vite-web", questions: { database: [] } }, "auth").asked).toBe(true)
    expect(
      availableChoices(
        catalog,
        { template: "vite-web", questions: { database: ["@acme/drizzle"] } },
        "database"
      ).choices.map((choice) => choice.disabled)
    ).toEqual([undefined, undefined, undefined])
  })

  it("names what conflicts, and the capability when no choice of the template provides it", () => {
    const strict = {
      ...catalog,
      addons: catalog.addons.map((addon) =>
        addon.id === "@acme/clerk" ? { ...addon, conflicts: ["@acme/convex"] } : addon
      )
    }
    expect(
      availableChoices(strict, { template: "vite-web", questions: { database: ["@acme/convex"] } }, "auth").choices[1]
    ).toMatchObject({ id: "@acme/clerk", disabled: "Can't be used with Convex" })
    const lonely = withTemplates(catalog, {
      id: "lonely",
      title: "Lonely",
      description: "",
      target: "vite-react",
      questions: ["auth"]
    })
    expect(availableChoices(lonely, { template: "lonely" }, "auth")).toEqual({
      asked: true,
      choices: [
        {
          id: "@acme/better-auth",
          label: "Better Auth",
          hint: "Sign-in stored in your own database",
          disabled: "Needs an add-on that provides orm"
        },
        { id: "@acme/clerk", label: "Clerk", hint: "Hosted sign-in" }
      ]
    })
  })

  it("asks a question with when only when it holds", () => {
    const seeded: CatalogManifest = {
      ...catalog,
      addons: [
        ...catalog.addons,
        defineAddon({ id: "@acme/seed", version: "1.0.0", title: "Seed data", description: "", contribute: () => [] })
      ],
      templates: catalog.templates.map((template) =>
        template.id === "vite-web"
          ? {
              ...template,
              questions: [
                ...(template.questions ?? []),
                {
                  id: "seed",
                  title: "Seed data",
                  question: "Add seed data?",
                  pick: "one",
                  choices: ["@acme/seed"],
                  when: { selected: ["provides:database"] }
                }
              ]
            }
          : template
      )
    }
    const asked = (questions: Answers["questions"]) =>
      availableChoices(seeded, { template: "vite-web", questions }, "seed").asked
    expect(asked({ database: [] })).toBe(false)
    expect(asked({ database: ["@acme/prisma"] })).toBe(true)
    // A question that isn't asked has no answer, so it isn't declined.
    const selection = selectionFromAnswers(seeded, { template: "vite-web", questions: { database: [] } }, "demo")
    expect(selection.ok && selection.selection.declined).not.toContain("question:seed")
  })
})

describe("answers to a selection", () => {
  const catalog = exampleCatalog()

  it("plans every default for a template with no answers", () => {
    const ids = resolved(catalog, { template: "saas" })
    expect(ids).toEqual(expect.arrayContaining(["@acme/drizzle", "@acme/better-auth", "npm:zod", "@acme/lingui"]))
    // Drizzle and Better Auth select their combination, and not the Prisma one.
    expect(ids).toContain("@acme/better-auth-drizzle")
    expect(ids).not.toContain("@acme/better-auth-prisma")
    expect(ids.indexOf("@acme/better-auth-drizzle")).toBeGreaterThan(ids.indexOf("@acme/drizzle"))
  })

  it("a preset answers questions: Prisma selects its combination, and no to telemetry's default", () => {
    const preset = catalog.presets?.find((candidate) => candidate.id === "saas-prisma")
    const ids = resolved(catalog, { ...preset!.answers })
    expect(ids).toContain("@acme/better-auth-prisma")
    expect(ids).not.toContain("@acme/better-auth-drizzle")
    expect(ids).not.toContain("@acme/posthog")
    expect(ids).toContain("@acme/lingui")
    const selection = selectionFromAnswers(catalog, { ...preset!.answers }, "demo")
    expect(selection.ok && selection.selection.declined).toEqual(["question:telemetry"])
  })

  it("records the choices a many question's answer leaves out", () => {
    const selection = selectionFromAnswers(
      catalog,
      { template: "vite-web", questions: { devtools: ["npm:storybook"], telemetry: ["@acme/sentry"] } },
      "demo"
    )
    expect(selection.ok && selection.selection.declined).toEqual([
      "@acme/posthog",
      "npm:@playwright/test",
      "question:auth",
      "question:database"
    ])
  })

  it("turns a required question with no default into a choose issue with every available choice", () => {
    const open = withTemplates(catalog, {
      id: "open",
      title: "Open",
      description: "",
      target: "vite-react",
      // A child's use keeps its parent's default, so this template asks the catalog's question directly.
      questions: [
        { use: "database", required: true },
        { use: "auth", required: true, default: "@acme/better-auth" }
      ]
    })
    expect(selectionFromAnswers(open, { template: "open" }, "demo")).toEqual({
      ok: false,
      issue: {
        kind: "choose",
        template: "open",
        question: "database",
        candidates: ["@acme/drizzle", "@acme/prisma", "@acme/convex"]
      }
    })
  })

  it("refuses no to a required question, and an answer it doesn't offer", () => {
    expect(
      thrown(() => selectionFromAnswers(catalog, { template: "saas", questions: { database: [] } }, "demo")).message
    ).toBe(`SaaS starter needs a database, so "no" isn't an answer.`)
    expect(
      thrown(() => selectionFromAnswers(catalog, { template: "saas", questions: { auth: ["@acme/sentry"] } }, "demo"))
        .message
    ).toBe("@acme/sentry isn't a choice for sign-in. Choose @acme/better-auth or @acme/clerk.")
    expect(
      thrown(() => selectionFromAnswers(catalog, { template: "saas", questions: { devtools: [] } }, "demo")).message
    ).toBe(`SaaS starter has no question "devtools".`)
  })
})

describe("issues and decisions", () => {
  const catalog = exampleCatalog()
  const resolve = (...ids: string[]) =>
    resolveSelection(catalog, {
      name: "demo",
      template: "vite-web",
      target: { id: "vite-react", mode: "spa" },
      addons: Object.fromEntries(ids.map((id) => [id, {}])),
      declined: []
    })

  it("reports a conflict by capability both ways, and never an add-on with itself", () => {
    expect(resolve("@acme/drizzle", "@acme/prisma")).toMatchObject({
      ok: false,
      issue: { kind: "conflicts", addon: "@acme/drizzle", other: "@acme/prisma", capability: "orm" }
    })
    // Only Convex declares it.
    expect(resolve("@acme/convex", "@acme/prisma")).toMatchObject({
      ok: false,
      issue: { kind: "conflicts", addon: "@acme/convex", other: "@acme/prisma", capability: "orm" }
    })
    expect(resolve("@acme/drizzle").ok).toBe(true)
  })

  it("asks for a provider when an add-on needs one", () => {
    expect(resolve("@acme/better-auth")).toEqual({
      ok: false,
      issue: {
        kind: "choose-provider",
        capability: "orm",
        by: "@acme/better-auth",
        candidates: ["@acme/drizzle", "@acme/prisma"]
      }
    })
  })

  it("every choice of a choose or choose-provider decision plans without asking again", async () => {
    const open = withTemplates(catalog, {
      id: "open",
      title: "Open",
      description: "",
      target: "vite-react",
      // A child's use keeps its parent's default, so this template asks the catalog's question directly.
      questions: [
        { use: "database", required: true },
        { use: "auth", required: true, default: "@acme/better-auth" }
      ]
    })
    const tree = () => memoryTree({})
    const choosing = await plan({ catalog: open, settings, tree: tree(), request: init({ template: "open" }) })
    expect(choosing.decisions[0]).toMatchObject({ id: "question:database", message: "Which database?" })
    expect(choosing.decisions[0]?.choices.map((choice) => choice.id)).toEqual([
      "@acme/drizzle",
      "@acme/prisma",
      "@acme/convex"
    ])
    const [drizzle] = choosing.decisions[0]?.choices ?? []
    expect(drizzle?.request.intent).toMatchObject({ answers: { questions: { database: ["@acme/drizzle"] } } })
    expect((await plan({ catalog: open, settings, tree: tree(), request: drizzle!.request })).status).toBe("planned")

    const provider = await plan({
      catalog,
      settings,
      tree: tree(),
      request: {
        intent: {
          command: "init",
          answers: { template: "vite-web", name: "demo", questions: { database: [], auth: ["@acme/better-auth"] } }
        }
      }
    })
    expect(provider.decisions[0]?.message).toBe("Better Auth needs a database. Which one?")
    for (const choice of provider.decisions[0]?.choices ?? []) {
      expect(choice.request.intent).toMatchObject({ answers: { questions: { database: [choice.id] } } })
      expect((await plan({ catalog, settings, tree: tree(), request: choice.request })).status).toBe("planned")
    }
  })

  it("names a swap after the question that offers both", async () => {
    const files = await plan({ catalog, settings, tree: memoryTree({}), request: init() })
    const tree: Record<string, string> = {}
    for (const operation of files.operations) {
      if (operation.content !== undefined) {
        tree[operation.path] = operation.content
      }
    }
    const swap = await plan({
      catalog,
      settings,
      tree: memoryTree(tree),
      request: { intent: { command: "add", addons: ["prisma"], replace: [], options: {} } }
    })
    expect(swap.decisions[0]?.message).toBe("Drizzle is your database. Replace it with Prisma?")
  })
})

describe("catalog checks for questions", () => {
  const catalog = exampleCatalog()

  it("report the problems a catalog's questions and templates can have", () => {
    const broken: CatalogManifest = {
      ...catalog,
      versions: Object.fromEntries(Object.entries(catalog.versions ?? {}).filter(([name]) => name !== "vitest")),
      templates: [
        ...catalog.templates,
        {
          id: "mixed",
          title: "Mixed",
          description: "",
          target: "vite-react",
          required: ["@acme/better-auth-drizzle"],
          questions: [
            "auth",
            "database",
            {
              id: "extras",
              title: "Extras",
              question: "Add extras?",
              choose: "Which ones?",
              pick: "many",
              default: ["@acme/clerk"],
              choices: ["@acme/drizzle", "@acme/prisma", "@acme/sentry"]
            },
            {
              id: "watch",
              title: "Watching",
              question: "Watch?",
              choose: "Which?",
              pick: "one",
              choices: ["@acme/sentry"]
            }
          ],
          gallery: { tags: ["Not Ok"], links: { docs: "http://acme.dev" } }
        },
        {
          id: "picky",
          title: "Picky",
          description: "",
          extends: "saas",
          questions: [{ use: "telemetry", default: "@acme/sentry" }]
        }
      ]
    }
    const problems = checkCatalog(broken)
    const missing = [
      "npm:vitest is a bare add-on, so the catalog needs a pin for vitest.",
      "Template mixed names @acme/better-auth-drizzle, a combination add-on, which is added with what it joins.",
      "Template mixed question extras picks many, and offers @acme/drizzle and @acme/prisma, which conflict.",
      "Template mixed question extras defaults to @acme/clerk, which it doesn't offer.",
      "Template mixed offers @acme/drizzle in two questions, database and extras.",
      "Template mixed offers @acme/sentry in two questions, extras and watch.",
      "Template mixed question auth offers @acme/better-auth, which needs provides:orm, and only a later question provides it. Ask that one first.",
      'Template mixed has the gallery tag "Not Ok", which isn\'t lowercase and hyphenated.',
      'Template mixed has the docs link "http://acme.dev", which isn\'t an https URL.',
      "Template picky gives question telemetry a default that doesn't match its pick, many."
    ].filter((expected) => !problems.includes(expected))
    expect(missing).toEqual([])
  })
})

describe("gallery images", () => {
  it("are https URLs or paths in the package, which a files check confirms", () => {
    const catalog = exampleCatalog()
    const imaged = (image: string): CatalogManifest =>
      withTemplates(catalog, { id: "shot", title: "Shot", description: "", target: "vite-react", gallery: { image } })
    expect(checkCatalog(imaged("https://acme.dev/shot.png"))).toEqual([])
    expect(checkCatalog(imaged("gallery/shot.png"))).toEqual([])
    expect(checkCatalog(imaged("http://acme.dev/shot.png"))).toEqual([
      `Template shot has the gallery image "http://acme.dev/shot.png", which isn't an https URL or a path in the package.`
    ])
    expect(checkCatalog(imaged("../shot.png"))).toEqual([
      `Template shot has the gallery image "../shot.png", which isn't a path inside the package.`
    ])
    const files = (path: string, template: string) => template !== "shot" || path === "gallery/here.png"
    expect(checkCatalog(imaged("gallery/here.png"), { files })).toEqual([])
    expect(checkCatalog(imaged("gallery/gone.png"), { files })).toEqual([
      `Template shot has the gallery image "gallery/gone.png", which isn't in the package.`
    ])
  })
})

describe("the wizard on questions", () => {
  const catalog = exampleCatalog()

  it("asks each question in order, with unavailable choices disabled and their reason as the hint", async () => {
    // A third provider, so the pick is still asked when Better Auth isn't available.
    const lucia = defineAddon({
      id: "@acme/lucia",
      version: "1.0.0",
      title: "Lucia",
      description: "Sessions you own",
      contribute: () => []
    })
    const catalog: CatalogManifest = {
      ...exampleCatalog(),
      addons: [...exampleCatalog().addons, lucia],
      questions: exampleCatalog().questions?.map((question) =>
        question.id === "auth" ? { ...question, choices: [...question.choices, "@acme/lucia"] } : question
      )
    }
    const { prompter, asked } = scriptedPrompter([
      true,
      "@acme/lingui",
      true,
      "@acme/convex",
      true,
      "@acme/clerk",
      false,
      true,
      ["npm:storybook"],
      "en"
    ])
    const answers = await runWizard({
      catalog,
      partial: { ...emptyAnswers(), template: "vite-web", name: "demo" },
      prompter,
      askName: false
    })
    expect(asked.map((question) => [question.kind, question.message])).toEqual([
      ["confirm", "Add localization?"],
      ["select", "Which library?"],
      ["confirm", "Add a database?"],
      ["select", "Which one?"],
      ["confirm", "Add sign-in?"],
      ["select", "Which provider?"],
      ["confirm", "Add telemetry?"],
      ["confirm", "Add developer tools?"],
      ["multiselect", "Which ones?"],
      ["text", "Lingui: Locales"]
    ])
    // A default makes yes the first answer and preselects it.
    expect(asked[0]?.initial).toBe(true)
    expect(asked[1]?.initial).toBe("@acme/lingui")
    expect(asked[5]).toMatchObject({
      options: ["@acme/better-auth", "@acme/clerk", "@acme/lucia"],
      disabled: ["@acme/better-auth"],
      hints: {
        "@acme/better-auth": "Needs Drizzle or Prisma",
        "@acme/clerk": "Hosted sign-in",
        "@acme/lucia": "Sessions you own"
      }
    })
    expect(asked[8]).toMatchObject({ required: true })
    expect(answers).toEqual({
      template: "vite-web",
      name: "demo",
      mode: "spa",
      questions: {
        localization: ["@acme/lingui"],
        database: ["@acme/convex"],
        auth: ["@acme/clerk"],
        telemetry: [],
        devtools: ["npm:storybook"]
      },
      options: { "@acme/lingui": { locales: ["en"] } }
    })
  })

  it("asks a required question without the yes or no, and stops when it's cancelled", async () => {
    const { prompter, asked } = scriptedPrompter([true, "@acme/lingui", cancelled])
    const answer = await runWizard({
      catalog,
      partial: { ...emptyAnswers(), template: "saas", name: "demo" },
      prompter,
      askName: false
    })
    expect(answer).toBe(cancelled)
    expect(asked.map((question) => question.message)).toEqual(["Add localization?", "Which library?", "Which one?"])
    expect(asked[2]?.initial).toBe("@acme/drizzle")
  })
})
