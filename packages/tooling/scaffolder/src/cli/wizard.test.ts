import { describe, expect, it } from "vite-plus/test"
import { defineAddon } from "../manifest/define.js"
import type { CatalogManifest } from "../manifest/types.js"
import { exampleCatalog } from "../testing/example.js"
import { scriptedPrompter, type ScriptedAnswer } from "../testing/prompter.js"
import { cancelled } from "./prompter.js"
import { completeAnswers, emptyAnswers, runWizard, type PartialAnswers } from "./wizard.js"

/** The example catalog with a third sign-in provider, so a pick is still asked when Better Auth isn't available. */
function catalog(): CatalogManifest {
  const example = exampleCatalog()

  const lucia = defineAddon({
    id: "@acme/lucia",
    version: "1.0.0",
    title: "Lucia",
    description: "Sessions you own",
    contribute: () => []
  })

  return {
    ...example,
    addons: [...example.addons, lucia],
    questions: example.questions?.map((question) =>
      question.id === "auth" ? { ...question, choices: [...question.choices, "@acme/lucia"] } : question
    )
  }
}

async function wizard(template: string, script: ScriptedAnswer[], partial: Partial<PartialAnswers> = {}) {
  const { prompter, asked } = scriptedPrompter(script)

  const answers = await runWizard({
    catalog: catalog(),
    partial: { ...emptyAnswers(), template, name: "demo", ...partial },
    prompter,
    askName: false
  })

  return { answers, asked, find: (message: string) => asked.find((question) => question.message === message) }
}

describe("the wizard asks each question as the wizard table says", () => {
  it("asks an optional question yes or no first, with yes first when it has a default, and no answers []", async () => {
    const { answers, asked } = await wizard("vite-web", [false, false, false, false, false])
    expect(asked.map((question) => [question.kind, question.message, question.initial])).toEqual([
      ["confirm", "Add localization?", true],
      ["confirm", "Add a database?", false],
      // With no database, Better Auth isn't available, but Clerk and Lucia are.
      ["confirm", "Add sign-in?", false],
      ["confirm", "Add telemetry?", false],
      ["confirm", "Add developer tools?", false]
    ])
    expect(answers).toMatchObject({
      questions: { localization: [], database: [], auth: [], telemetry: [], devtools: [] }
    })
  })

  it("takes the one available choice without asking which", async () => {
    const { asked, answers } = await wizard("vite-web", [false, true, "@acme/convex", true, "@acme/clerk"], {
      questions: { telemetry: [], devtools: [] }
    })

    expect(asked.map((question) => question.message)).toEqual([
      "Add localization?",
      "Add a database?",
      "Which one?",
      "Add sign-in?",
      "Which provider?"
    ])
    // A catalog without Lucia leaves Clerk as the only provider, so it's the answer.
    const { prompter, asked: plain } = scriptedPrompter([false, true, "@acme/convex", true])

    const only = await runWizard({
      catalog: exampleCatalog(),
      partial: { ...emptyAnswers(), template: "vite-web", name: "demo", questions: { telemetry: [], devtools: [] } },
      prompter,
      askName: false
    })

    expect(plain.at(-1)?.message).toBe("Add sign-in?")
    expect(only).toMatchObject({ questions: { auth: ["@acme/clerk"] } })
    expect(answers).toMatchObject({ questions: { auth: ["@acme/clerk"] } })
  })

  it("selects a one question's choice, starting on the default only when it's available", async () => {
    const started = await wizard("saas", [true, "@acme/react-intl", "@acme/drizzle", "@acme/better-auth", false])
    expect(started.find("Which library?")?.initial).toBe("@acme/lingui")
    expect(started.find("Which one?")?.initial).toBe("@acme/drizzle")
    expect(started.find("Which provider?")?.initial).toBe("@acme/better-auth")
    // Convex rules out the default, Better Auth, so the pick starts nowhere and shows it disabled.
    const ruled = await wizard("saas", [false, "@acme/convex", "@acme/clerk", false])
    expect(ruled.find("Which provider?")).toMatchObject({
      kind: "select",
      initial: undefined,
      options: ["@acme/better-auth", "@acme/clerk", "@acme/lucia"],
      disabled: ["@acme/better-auth"],
      hints: { "@acme/better-auth": "Needs Drizzle or Prisma" }
    })
  })

  it("asks a many question with a multi-select of at least one, its available defaults checked", async () => {
    const { find, answers } = await wizard("saas", [
      false,
      "@acme/drizzle",
      "@acme/better-auth",
      true,
      ["@acme/sentry"]
    ])

    expect(find("Which ones?")).toMatchObject({
      kind: "multiselect",
      required: true,
      initial: ["@acme/posthog"],
      options: ["@acme/sentry", "@acme/posthog"]
    })
    expect(answers).toMatchObject({ questions: { telemetry: ["@acme/sentry"] } })
  })

  it("shows choices in order with their hints", async () => {
    const { find } = await wizard("vite-web", [false, false, false, false, true, []], {})
    expect(find("Which ones?")).toMatchObject({
      options: ["npm:storybook", "npm:@playwright/test"],
      hints: { "npm:storybook": "Build components in isolation", "npm:@playwright/test": "End-to-end tests" }
    })
  })

  it("skips a question that isn't asked without a word", async () => {
    const seeded: CatalogManifest = {
      ...catalog(),
      addons: [
        ...catalog().addons,
        defineAddon({ id: "@acme/seed", version: "1.0.0", title: "Seed data", description: "", contribute: () => [] })
      ],
      templates: catalog().templates.map((template) =>
        template.id === "vite-web"
          ? {
              ...template,
              questions: [
                "database",
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

    const { prompter, asked } = scriptedPrompter([false])

    const answers = await runWizard({
      catalog: seeded,
      partial: { ...emptyAnswers(), template: "vite-web", name: "demo" },
      prompter,
      askName: false
    })

    expect(asked.map((question) => question.message)).toEqual(["Add a database?"])
    expect(answers).toMatchObject({ questions: { database: [] } })
    expect(answers !== cancelled && answers.questions?.seed).toBeUndefined()
  })

  it("asks only the questions flags and presets leave open", async () => {
    const { asked } = await wizard("saas", [false], {
      questions: { database: ["@acme/prisma"], auth: ["@acme/clerk"] },
      with: ["sentry"]
    })

    // --with sentry answers telemetry from its default, so only localization is left.
    expect(asked.map((question) => question.message)).toEqual(["Add localization?"])
  })

  it("stops at a cancel at any prompt", async () => {
    for (const script of [
      [cancelled],
      [true, cancelled],
      [false, "@acme/drizzle", "@acme/better-auth", true, cancelled],
      [true, "@acme/lingui", "@acme/drizzle", "@acme/better-auth", false, cancelled]
    ] satisfies ScriptedAnswer[][]) {
      const { answers } = await wizard("saas", script)
      expect(answers).toBe(cancelled)
    }
  })
})

describe("answers from flags", () => {
  const complete = (partial: Partial<PartialAnswers>) =>
    completeAnswers(catalog(), { ...emptyAnswers(), template: "saas", ...partial })

  it("--with adds to the question that offers it, from its default, or to extra", () => {
    expect(complete({ with: ["sentry", "@acme/lingui"] }).questions).toEqual({
      telemetry: ["@acme/posthog", "@acme/sentry"],
      localization: ["@acme/lingui"]
    })
    // A one question takes the add-on in place of its default.
    expect(complete({ with: ["prisma"] }).questions).toEqual({ database: ["@acme/prisma"] })
    expect(complete({ with: ["lucia", "storybook"] })).toMatchObject({
      questions: { auth: ["@acme/lucia"] },
      // saas leaves out developer tools, so Storybook goes in extra.
      extra: ["npm:storybook"]
    })
  })

  it("--without takes an add-on out of its question's answer, and a question left with nothing is no", () => {
    expect(complete({ without: ["posthog"] }).questions).toEqual({ telemetry: [] })
    expect(complete({ with: ["sentry"], without: ["posthog"] }).questions).toEqual({ telemetry: ["@acme/sentry"] })
    expect(complete({ extra: ["npm:storybook"], without: ["storybook"] }).extra).toBeUndefined()
  })
})
