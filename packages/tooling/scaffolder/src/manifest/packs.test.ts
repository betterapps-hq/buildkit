import { describe, expect, it } from "vite-plus/test"
import { PlanError } from "../plan/errors.js"
import { selectionFromAnswers } from "../resolve/answers.js"
import { checkCatalog } from "../resolve/check.js"
import { exampleCatalog } from "../testing/example.js"
import { fixtureCatalog } from "../testing/fixture.js"
import { catalogVersionText, expandTemplate, sameCatalogVersion, writtenVersions } from "./catalog.js"
import { mergePacks, templateSource, type LoadedPack } from "./packs.js"
import type { TemplatePack } from "./types.js"

function towerPack(overrides: Partial<TemplatePack> = {}): TemplatePack {
  return {
    extends: { catalog: "@fixture/catalog", versions: "^1.0.0" },
    templates: [
      {
        id: "tower",
        title: "Tower",
        description: "A tower defense app",
        target: "web",
        required: ["@acme/tower/turrets"],
        questions: [{ use: "ui", required: true, default: "@fixture/ui-basic" }]
      }
    ],
    addons: [
      {
        id: "@acme/tower/turrets",
        version: "1.0.0",
        title: "Turrets",
        description: "Turret logic",
        contribute: () => [
          { kind: "file", path: "src/turrets.ts", content: "export const turrets = 1\n", ownership: "seed" }
        ]
      }
    ],
    ...overrides
  }
}

const loaded = (pack: TemplatePack, name = "@acme/tower"): LoadedPack => ({
  name,
  version: "1.0.0",
  integrity: "sha512-test",
  pack
})

function failure(run: () => unknown): { code: string; message: string } {
  try {
    run()
  } catch (error) {
    if (error instanceof PlanError) {
      return { code: error.code, message: error.message }
    }
    throw error
  }
  throw new Error("expected a PlanError")
}

describe("packs on questions", () => {
  /** A third party's shop: the SaaS starter with Stripe, which needs the catalog's database. */
  function shopPack(overrides: Partial<TemplatePack> = {}): TemplatePack {
    return {
      extends: { catalog: "@acme/catalog", versions: "^2.0.0" },
      versions: { stripe: "19.1.0" },
      addons: [
        {
          id: "@shopco/starter/stripe",
          version: "1.0.0",
          title: "Stripe",
          description: "Checkout and webhooks",
          requires: ["provides:database"],
          contribute: (ctx) => [{ kind: "dependency", name: "stripe", version: ctx.version("stripe") }]
        }
      ],
      templates: [
        {
          id: "shop",
          title: "Shop",
          description: "The SaaS starter with Stripe checkout",
          extends: "saas",
          required: ["@shopco/starter/stripe"]
        }
      ],
      ...overrides
    }
  }
  const merge = (pack: TemplatePack) => mergePacks(exampleCatalog(), [loaded(pack, "@shopco/starter")])

  it("extends a catalog template, and the merged catalog has no problems", () => {
    const merged = merge(shopPack())
    expect(checkCatalog(merged, { matrix: true })).toEqual([])
    const shop = expandTemplate(merged, "@shopco/starter#shop")
    expect(shop?.questions.map((question) => question.id)).toEqual(["localization", "database", "auth", "telemetry"])
    expect(shop?.required).toEqual(["npm:vite-plus", "npm:vitest", "npm:zod", "@shopco/starter/stripe"])
    // Its pins join the catalog's, written in the catalog's range style.
    const selection = selectionFromAnswers(merged, { template: "@shopco/starter#shop" }, "demo")
    expect(selection.ok && Object.keys(selection.selection.addons)).toContain("@acme/drizzle")
    expect(merged.versions?.stripe).toBe("19.1.0")
    expect(writtenVersions(merged).stripe).toBe("^19.1.0")
  })

  it("can't answer no to the database it inherits as required", () => {
    const merged = merge(shopPack())
    expect(
      failure(() =>
        selectionFromAnswers(merged, { template: "@shopco/starter#shop", questions: { database: [] } }, "demo")
      )
    ).toEqual({ code: "E_USAGE", message: `Shop needs a database, so "no" isn't an answer.` })
  })

  it("extends its own templates, and asks questions of its own", () => {
    const merged = merge(
      shopPack({
        questions: [
          {
            id: "payments",
            title: "Payments",
            question: "Take payments?",
            pick: "one",
            choices: ["@shopco/starter/stripe"]
          }
        ],
        templates: [
          { id: "shop", title: "Shop", description: "", extends: "saas", questions: ["payments"] },
          { id: "outlet", title: "Outlet", description: "", extends: "shop", omit: ["telemetry"] }
        ]
      })
    )
    expect(merged.templates.find((template) => template.id === "@shopco/starter#outlet")?.extends).toBe(
      "@shopco/starter#shop"
    )
    expect(expandTemplate(merged, "@shopco/starter#outlet")?.questions.map((question) => question.id)).toEqual([
      "localization",
      "database",
      "auth",
      "payments"
    ])
    expect(checkCatalog(merged, { matrix: true })).toEqual([])
  })

  it.each([
    [{ versions: { react: "19.0.0" } }, "pins react, which @acme/catalog pins"],
    [
      { questions: [{ id: "auth", title: "Auth", question: "Add auth?", pick: "one" as const, choices: [] }] },
      "defines question auth, which @acme/catalog or another package has"
    ],
    [
      { questions: [{ id: "json", title: "J", question: "J?", pick: "one" as const, choices: [] }] },
      'a question with the id "json"'
    ],
    [
      { templates: [{ id: "shop", title: "Shop", description: "", extends: "nowhere" }] },
      "template shop extends nowhere, which isn't a template of @acme/catalog or of the package"
    ]
  ])("refuses a pack with %j", (overrides, message) => {
    const result = failure(() => merge(shopPack(overrides as Partial<TemplatePack>)))
    expect(result.code).toBe("E_INVALID_PACK")
    expect(result.message).toContain(message)
  })
})

describe("templateSource", () => {
  it.each([
    ["@acme/tower", { package: "@acme/tower", range: "latest" }],
    ["@acme/tower@^2", { package: "@acme/tower", range: "^2" }],
    ["@acme/tower@1.2.0#siege", { package: "@acme/tower", range: "1.2.0", template: "siege" }],
    ["@acme/starters#tower", { package: "@acme/starters", range: "latest", template: "tower" }],
    ["npm:tower-defense", { package: "tower-defense", range: "latest" }],
    ["npm:tower-defense@next", { package: "tower-defense", range: "next" }],
    ["npm:@acme/tower", { package: "@acme/tower", range: "latest" }]
  ])("reads %s as a package", (argument, source) => {
    expect(templateSource(argument)).toEqual(source)
  })

  it.each(["app", "tower-defense", "pixi"])("leaves the catalog template %s alone", (argument) => {
    expect(templateSource(argument)).toBeUndefined()
  })

  it.each(["@acme", "@acme/tower#a#b", "npm:", "@acme/tower@", "@Acme/Tower", "@acme/tower#../x"])(
    "rejects %s",
    (argument) => {
      expect(failure(() => templateSource(argument)).code).toBe("E_USAGE")
    }
  )
})

describe("mergePacks", () => {
  it("adds a pack's templates under its name and its add-ons, and records its version", () => {
    const catalog = fixtureCatalog()
    const merged = mergePacks(catalog, [loaded(towerPack())])
    expect(merged.templates.map((template) => template.id)).toEqual(["app", "bare", "@acme/tower#tower"])
    expect(merged.addons.at(-1)?.id).toBe("@acme/tower/turrets")
    expect(merged.packs).toEqual({ "@acme/tower": { version: "1.0.0", integrity: "sha512-test" } })
    expect(catalog.templates).toHaveLength(2)
    expect(mergePacks(catalog, [])).toBe(catalog)
    expect(checkCatalog(merged)).toEqual([])
  })

  it.each([
    [{ extends: { catalog: "@other/catalog", versions: "^1.0.0" } }, "E_INVALID_PACK", "extends @other/catalog"],
    [{ extends: { catalog: "@fixture/catalog", versions: "^2.0.0" } }, "E_CATALOG_MISMATCH", "works with"],
    [{ extends: { catalog: "@fixture/catalog", versions: "one" } }, "E_INVALID_PACK", "catalog range"],
    [{ templates: [] }, "E_INVALID_PACK", "no templates"],
    [{ templates: [{ id: "@acme/x", title: "X", description: "", target: "web" }] }, "E_INVALID_PACK", 'id "@acme/x"'],
    [
      { addons: [{ id: "@fixture/turrets", version: "1.0.0", title: "T", description: "", contribute: () => [] }] },
      "E_INVALID_PACK",
      "start with @acme/tower/"
    ],
    [
      { templates: [{ id: "tower", title: "Tower", description: "", target: "native" }] },
      "E_INVALID_PACK",
      "uses target native"
    ],
    [{ templates: [{ title: "Tower", description: "", target: "web" }] }, "E_INVALID_PACK", "id undefined"],
    [
      { addons: [{ version: "1.0.0", title: "T", description: "", contribute: () => [] }] },
      "E_INVALID_PACK",
      "add-on with the id undefined"
    ],
    [
      {
        addons: [
          {
            id: "@acme/tower/turrets",
            version: "1.0.0",
            title: "T",
            description: "",
            points: [{ id: "app.providers", version: 1, kind: "wrap", file: "src/providers.ts", export: "providers" }],
            contribute: () => []
          }
        ]
      },
      "E_INVALID_PACK",
      "defines points"
    ]
  ] as const)("refuses a pack with %j", (overrides, code, message) => {
    const result = failure(() => mergePacks(fixtureCatalog(), [loaded(towerPack(overrides as Partial<TemplatePack>))]))
    expect(result.code).toBe(code)
    expect(result.message).toContain(message)
  })

  it("compares and names catalog versions with their packs", () => {
    const merged = mergePacks(fixtureCatalog(), [loaded(towerPack())])
    expect(sameCatalogVersion(merged, { version: "1.0.0", packs: { "@acme/tower": { version: "1.0.0" } } })).toBe(true)
    expect(sameCatalogVersion(merged, { version: "1.0.0", packs: { "@acme/tower": { version: "1.1.0" } } })).toBe(false)
    expect(sameCatalogVersion(merged, { version: "1.0.0" })).toBe(false)
    expect(catalogVersionText(merged)).toBe("1.0.0 with @acme/tower@1.0.0")
    expect(catalogVersionText(fixtureCatalog())).toBe("1.0.0")
  })
})

describe("checkCatalog", () => {
  it("keeps built-in template ids from looking like packages", () => {
    const catalog = fixtureCatalog()
    for (const id of ["@acme/app", "app#web", "web:app"]) {
      const problems = checkCatalog({ ...catalog, templates: [{ ...catalog.templates[0]!, id }] })
      expect(problems).toContain(`Template id ${id} can't contain /, # or :, or start with @.`)
    }
  })
})
