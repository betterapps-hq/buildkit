import type { z } from "zod"

/** Classes a file contribution can claim. `shared` files are edited by key, and `user` files are never touched. */
export type Ownership = "owned" | "seed" | "sample"

export type FileClass = Ownership | "shared" | "user"

export type Band = "pre" | "framework" | "post"

export type PointKind = "list" | "nest" | "wrap" | "map" | "single" | "chain"

/** Entries are data, never code strings. Each renderer prints them in its own language. */
export type EntryValue =
  | { ref: { module: string; export: string } }
  | { call: { module: string; export: string; args?: unknown[] } }
  | { value: unknown }

export interface Order {
  band?: Band
  before?: string[]
  after?: string[]
}

export interface PointDefinition {
  /** Point id, such as `vite.plugins` or `app.providers`. */
  id: string
  /** Contract version. Bump it when entries change shape. */
  version: number
  kind: PointKind
  title?: string
  /** Generated file the point renders into, relative to the project root. Points may share a file. */
  file: string
  /** Name of the binding the generated file exports for this point. */
  export: string
  /** Schema for `{ value }` entries. */
  payload?: z.ZodType
}

export type JsonOp = "set" | "append" | "merge"

/**
 * Where a new item goes in a keyed array, by the keys of the items it follows or precedes, such as `after: ["build"]`
 * for a CI step. It goes after the last of `after` that the array has, else before the first of `before`, else at the
 * end. It places an item when it's added, and never moves one that's there.
 */
export interface ItemOrder {
  after?: string[]
  before?: string[]
}

export type Contribution =
  | { kind: "dependency"; name: string; version: string; dev?: boolean }
  | { kind: "script"; name: string; command: string }
  | {
      kind: "env"
      name: string
      scope: "server" | "client" | "build"
      secret: boolean
      required: boolean
      description: string
      example?: string
      /** Where to get a value, such as the provider's dashboard. An https URL. */
      help?: string
    }
  | { kind: "file"; path: string; content: string; ownership: Ownership }
  | {
      kind: "entry"
      point: string
      id: string
      value: EntryValue
      order?: Order
      when?: "required" | "if-present"
    }
  | {
      kind: "json"
      path: string
      pointer: string
      op: JsonOp
      value: unknown
      /** For `append`: the field that identifies an item, making the array keyed. Without it, the array is a set. */
      key?: string
      /** For `append` to a keyed array: where new items go. */
      order?: ItemOrder
    }
  | { kind: "yaml"; path: string; pointer: string; op: JsonOp; value: unknown; key?: string; order?: ItemOrder }
  | { kind: "lines"; path: string; lines: string[] }
  | { kind: "command"; run: string; when: "after-install" | "after-apply"; why: string }
  | { kind: "notice"; code: string; text: string }

/** How a catalog writes a pin that's an exact version. A pin that's already a range is written as it is. */
export type RangeStyle = "exact" | "caret" | "tilde"

export interface TargetInfo {
  id: string
  family: string
  mode: string
  renderModel: string
  /** True when the target's mode has the facet. Throws for a facet the catalog doesn't register. */
  has(facet: string): boolean
}

export interface ResolveContext<O> {
  options: O
  target: TargetInfo
  /** Data another selected add-on provides, such as `{ dialect: "sqlite" }`. Narrow it before use. */
  // oxlint-disable-next-line anti-slop/no-unknown-returns -- each add-on declares its own `provides` data, so only the reader knows what to narrow it to
  provided(name: string): unknown
  /** True when the add-on is part of the resolved selection. */
  selected(id: string): boolean
}

export interface ContributeContext<O> extends ResolveContext<O> {
  project: { name: string }
  /** Catalog-pinned versions as they're written into `package.json`, keyed by package name. */
  versions: Readonly<Record<string, string>>
  /**
   * The pinned version of a package as it's written, such as `^19.3.1` in a `caret` catalog. A package the catalog
   * doesn't pin is a plan error.
   */
  version(name: string): string
  /** Picks the integration module for the target's framework family. A missing family is a plan error. */
  runtimeModule(map: Record<string, string>): string
  /** Records that an option doesn't apply to this target, as an `option-ignored` notice. */
  ignored(option: string, reason: string): void
}

/** A file view that migrations and adoption codemods read and edit. Changes become plan operations. */
export interface MutableTree {
  read(path: string): string | undefined
  write(path: string, content: string): void
  delete(path: string): void
}

export interface Migration {
  /** Runs when the recorded version < `version` <= the new version. */
  version: string
  description: string
  kind: "codemod" | "packages" | "options" | "agent"
  run?(tree: MutableTree): void
  /** Rewrites the add-on's recorded options. */
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- recorded options predate the add-on's current schema, which parses what this returns
  options?(old: Record<string, unknown>): Record<string, unknown>
  /** An agent task, surfaced in the plan and never run. */
  prompt?: string
}

export interface AddonManifest<S extends z.ZodType = z.ZodType> {
  /** Namespaced id, such as `@buildkit/i18n`. `npm:` ids are bare add-ons, which the engine makes. */
  id: string
  version: string
  title: string
  description: string
  /** Typed data other add-ons read with `ctx.provided()`, keyed by capability, such as `orm` or `database`. */
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- each capability's data is the providing add-on's own contract, narrowed by the reader
  provides?: Record<string, unknown>
  /** Pulled in with this add-on (ids), or needed from another (`provides:<name>`). */
  requires?: AddonReference[]
  /**
   * Never installed together. `provides:<name>` means any other add-on that provides it, so Drizzle's
   * `["provides:orm"]` keeps every other ORM out. One side declaring it is enough.
   */
  conflicts?: AddonReference[]
  /**
   * A combination add-on, such as the glue between an auth library and an ORM: selected when every reference (an id or
   * `provides:<name>`) is selected, and removed when one isn't. It's never asked about or added by name.
   */
  joins?: AddonReference[]
  /**
   * The ranges of packages this add-on is written for, such as `{ "drizzle-orm": ">=0.45 <1" }`. Catalog CI checks the
   * lowest version each pin allows is in its range.
   */
  packages?: Record<string, string>
  /** Ordering only: contribute after these add-ons when they're selected. */
  after?: string[]
  points?: PointDefinition[]
  options?: S
  /** Option keys the wizard asks about. The rest take their defaults. */
  ask?: string[]
  supports?(ctx: ResolveContext<z.infer<S>>): true | string
  contribute(ctx: ContributeContext<z.infer<S>>): Contribution[]
  migrations?: Migration[]
  nextSteps?(ctx: ContributeContext<z.infer<S>>): string[]
}

export interface TargetMode {
  id: string
  title: string
  renderModel: string
  facets: string[]
}

export interface TargetContext {
  target: TargetInfo
  project: { name: string }
  versions: Readonly<Record<string, string>>
  version(name: string): string
}

export interface TargetManifest {
  id: string
  title: string
  description: string
  family: string
  modes: TargetMode[]
  /** Points this target owns. Each one is wired at `create`, so `add` never edits your files. */
  points?: PointDefinition[]
  /** Base files, dependencies and wiring for a new project. */
  base(ctx: TargetContext): Contribution[]
  /** Codemods that wire an existing project once, when it's adopted with `create --adopt`. */
  adopt?(tree: MutableTree, ctx: TargetContext): void
}

/** An add-on id, or `provides:<name>` for any add-on that provides it. */
export type AddonReference = string

/** A bare add-on: one package at the catalog's pin, and nothing else. Recorded as `npm:<name>`. */
export interface PackageAddon {
  npm: string
  dev?: boolean
  /** Defaults to the package name. */
  title?: string
  description?: string
}

/** An add-on a template installs or offers: an id, `npm:<name>` for a bare add-on, or a bare add-on with details. */
export type AddonRef = string | PackageAddon

/** One choice in a question. `hint` is the line beside it, defaulting to the add-on's description. */
export type Choice = string | { addon: string; label?: string; hint?: string } | (PackageAddon & { hint?: string })

/** When a question is asked, by what the required add-ons and earlier answers select. */
export interface Condition {
  /** Every reference matches. */
  selected?: AddonReference[]
  /** No reference matches. */
  notSelected?: AddonReference[]
}

interface QuestionFields {
  /**
   * Unique in the template: lowercase letters, digits and hyphens. It's the flag (`--database`), the name
   * `add database` answers, and the key in answers.
   */
  id: string
  /** A noun for messages, `catalog --json` and the gallery, such as "Database". */
  title: string
  /** The pick, such as "Which ORM?". Not asked when only one choice is available. */
  choose?: string
  /** In the order the wizard shows them. */
  choices: Choice[]
  when?: Condition
}

/** A required question has no yes or no. An optional one asks `question` first. */
type Asking = { required: true; question?: string } | { required?: false; question: string }

/** `one` is a select (radio buttons). `many` is a multi-select of at least one (checkboxes). */
type Picking = { pick: "one"; default?: string } | { pick: "many"; default?: string[] }

/** A question: yes or no unless it's required, then which. `default` preselects, and makes yes the first answer. */
export type QuestionDefinition = QuestionFields & Asking & Picking

/** A catalog question in a template, with what this template changes. */
export interface QuestionUse {
  use: string
  choices?: Choice[]
  default?: string | string[]
  required?: boolean
  when?: Condition
}

export interface Gallery {
  /** Lowercase and hyphenated. */
  tags?: string[]
  /** An https URL, or a path in the catalog's or pack's package, such as `gallery/saas.png`. */
  image?: string
  links?: { docs?: string; demo?: string; source?: string }
}

interface TemplateFields {
  id: string
  title: string
  description: string
  /** Modes offered, asked when there's more than one. Defaults to the parent's, then all the target's. */
  modes?: string[]
  /** Installed every time, never asked about. Added to the parent's. */
  required?: AddonRef[]
  /** Asked in order. An id uses a catalog question. A parent's question with the same id is replaced in place. */
  questions?: (string | QuestionUse | QuestionDefinition)[]
  /** Question ids and required add-ons the parent has that this template leaves out. */
  omit?: string[]
  /** Not inherited. */
  gallery?: Gallery
}

/** A template names its target, or extends another template and inherits it. */
export type TemplateManifest = TemplateFields &
  ({ target: string; extends?: undefined } | { extends: string; target?: undefined })

export interface Answers {
  template: string
  mode?: string
  /** The project name, used for the folder and `package.json`. */
  name?: string
  /** Each question's chosen add-on ids, `[]` for no. An unanswered question takes its default. */
  questions?: Record<string, string[]>
  /** Add-ons no question offers, added as `add` would add them. */
  extra?: string[]
  /** Options keyed by add-on id. */
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- each add-on's `options` schema types its values, and the resolver parses them with it
  options?: Record<string, Record<string, unknown>>
  /** Adopt an existing project: existing files stay yours, and the target wires it once. */
  adopt?: boolean
}

export interface PresetManifest {
  id: string
  title: string
  /** Saved answers. The wizard asks only what's left. */
  answers: Omit<Answers, "name">
}

export interface CatalogManifest {
  /** Package name of the catalog, such as `@buildkitgg/catalog`. */
  id: string
  version: string
  /** Every facet a target may declare. Checking an unregistered facet throws. */
  facets: readonly string[]
  /** Package pins: an exact version or an npm range, such as `19.3.1`, `^19.3.1` or `~0.45.4`. */
  versions?: Record<string, string>
  /** How exact pins are written into `package.json`. Defaults to `exact`. */
  range?: RangeStyle
  targets: TargetManifest[]
  templates: TemplateManifest[]
  /** Questions templates use by id. */
  questions?: QuestionDefinition[]
  addons: AddonManifest[]
  presets?: PresetManifest[]
  /** Template and add-on packages merged into this catalog, keyed by name. The engine sets it; a catalog never does. */
  packs?: Record<string, PackRecord>
}

/** A template or add-on package version, as the catalog it's merged into and the lock record it. */
export interface PackRecord {
  version: string
  /** npm's integrity for the package, checked every time it's loaded. */
  integrity?: string
}

/**
 * A template package's default export: templates, and the add-ons and questions they need, for the targets and points
 * of the product catalog it extends. Its templates can extend the catalog's and ask its questions. It can't add targets
 * or points, or replace anything the catalog defines.
 */
export interface TemplatePack {
  /** The product catalog's id, and the catalog versions this pack works with, as an npm range such as `^1.0.0`. */
  extends: { catalog: string; versions: string }
  /** Ids are unique in the pack, without `/`, `#` or `:`. A project records one as `<package>#<id>`. */
  templates: TemplateManifest[]
  /** Ids start with `<package>/`, so they never collide with the catalog's or another pack's. */
  addons?: AddonManifest[]
  /** Questions the pack's templates use by id. An id can't be a catalog question's id or one of the CLI's flags. */
  questions?: QuestionDefinition[]
  /** Pins for packages the catalog doesn't pin, used by the pack's add-ons and bare add-ons. It can't change the catalog's. */
  versions?: Record<string, string>
}

/**
 * An add-on package's default export: add-ons for the product catalog it extends, which `add` installs by the package's
 * name. It can't add targets, points, questions or templates, or replace anything the catalog defines.
 */
export interface AddonPack {
  /** The product catalog's id, and the catalog versions this package works with, as an npm range such as `^1.0.0`. */
  extends: { catalog: string; versions: string }
  /** Ids start with `<package>/`, so they never collide with the catalog's or another package's. */
  addons: AddonManifest[]
  /** Pins for packages the catalog doesn't pin, used by the add-ons. It can't change the catalog's. */
  versions?: Record<string, string>
}
