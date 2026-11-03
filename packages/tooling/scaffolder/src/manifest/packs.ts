import { PlanError } from "../plan/errors.js"
import { isRecord } from "../plan/json.js"
import { checkCatalog, cliFlags, questionIdPattern } from "../resolve/check.js"
import { satisfiesRange } from "../upgrade/semver.js"
import type { CatalogManifest, PackRecord, TemplateManifest, TemplatePack } from "./types.js"

/** A template package named on the command line: `@scope/name`, `@scope/name@^2`, `npm:name`, `@scope/name#id`. */
export interface TemplateSource {
  package: string
  /** A version, a range or a dist-tag. */
  range: string
  /** The template, when the package has several. */
  template?: string
}

const scopedName = /^@[a-z0-9][a-z0-9-._~]*\/[a-z0-9][a-z0-9-._~]*$/
const unscopedName = /^[a-z0-9][a-z0-9-._~]*$/
const localId = /^[a-z0-9][a-z0-9-._]*$/i

/**
 * Reads a template argument as a package. A scoped name, or any name after `npm:`, is a package. Catalog template ids
 * can't look like either, so a mistyped built-in id is never fetched. Returns `undefined` for anything else.
 */
export function templateSource(argument: string): TemplateSource | undefined {
  const npm = argument.startsWith("npm:")
  const text = npm ? argument.slice(4) : argument
  if (!npm && !text.startsWith("@")) {
    return undefined
  }
  const [spec = "", template, ...rest] = text.split("#")
  const at = spec.indexOf("@", spec.startsWith("@") ? 1 : 0)
  const name = at === -1 ? spec : spec.slice(0, at)
  const range = at === -1 ? "latest" : spec.slice(at + 1)
  if (
    rest.length > 0 ||
    !(scopedName.test(name) || (npm && unscopedName.test(name))) ||
    range === "" ||
    /\s/.test(range) ||
    (template !== undefined && !localId.test(template))
  ) {
    throw new PlanError(
      "E_USAGE",
      `"${argument}" isn't a template package. Use @scope/name, @scope/name@<version> or npm:name, and #<template> to pick one of several.`
    )
  }
  return { package: name, range, ...(template === undefined ? {} : { template }) }
}

export function isTemplatePack(value: unknown): value is TemplatePack {
  return (
    isRecord(value) &&
    isRecord(value.extends) &&
    typeof value.extends.catalog === "string" &&
    typeof value.extends.versions === "string" &&
    Array.isArray(value.templates) &&
    (value.addons === undefined || Array.isArray(value.addons)) &&
    (value.questions === undefined || Array.isArray(value.questions)) &&
    (value.versions === undefined || isRecord(value.versions))
  )
}

export interface LoadedPack extends PackRecord {
  name: string
  pack: TemplatePack
}

/**
 * The product catalog with template packages merged in. Each pack must extend this catalog, at a version in its
 * range, and keep to its own ids. The merged catalog then has to pass `checkCatalog`, so a pack that breaks a rule
 * stops before anything is planned.
 */
/**
 * A pack's template as the merged catalog has it: `<package>#<id>`, extending a template of the same pack by its
 * recorded id, or one of the catalog's by its own.
 */
function packTemplate(
  catalog: CatalogManifest,
  name: string,
  label: string,
  pack: TemplatePack,
  template: TemplateManifest
): TemplateManifest {
  const id = `${name}#${template.id}`
  if (template.extends === undefined) {
    return { ...template, id }
  }
  const parent = template.extends
  if (pack.templates.some((other) => other.id === parent)) {
    return { ...template, id, extends: `${name}#${parent}` }
  }
  if (catalog.templates.some((other) => other.id === parent && !other.id.includes("#"))) {
    return { ...template, id }
  }
  throw new PlanError(
    "E_INVALID_PACK",
    `${label}'s template ${template.id} extends ${parent}, which isn't a template of ${catalog.id} or of the package.`
  )
}

export function mergePacks(catalog: CatalogManifest, packs: readonly LoadedPack[]): CatalogManifest {
  if (packs.length === 0) {
    return catalog
  }
  const merged: CatalogManifest = {
    ...catalog,
    templates: [...catalog.templates],
    addons: [...catalog.addons],
    questions: [...(catalog.questions ?? [])],
    versions: { ...catalog.versions },
    packs: { ...catalog.packs }
  }
  const pinnedBy = new Map<string, string>()
  for (const { name, version, integrity, pack } of packs) {
    const label = `${name}@${version}`
    if (pack.extends.catalog !== catalog.id) {
      throw new PlanError("E_INVALID_PACK", `${label} extends ${pack.extends.catalog}, not ${catalog.id}.`)
    }
    let compatible: boolean
    try {
      compatible = satisfiesRange(catalog.version, pack.extends.versions)
    } catch {
      throw new PlanError("E_INVALID_PACK", `${label} has "${pack.extends.versions}" as its catalog range.`)
    }
    if (!compatible) {
      throw new PlanError(
        "E_CATALOG_MISMATCH",
        `${label} works with ${catalog.id} ${pack.extends.versions}, and this CLI has ${catalog.version}. Use a CLI with a catalog in that range, or another version of ${name}.`
      )
    }
    if (pack.templates.length === 0) {
      throw new PlanError("E_INVALID_PACK", `${label} has no templates.`)
    }
    // A pack comes from a dynamic import, so its ids are checked as well as typed.
    for (const template of pack.templates) {
      const id: unknown = template.id
      if (typeof id !== "string" || !localId.test(id)) {
        throw new PlanError(
          "E_INVALID_PACK",
          `${label} has a template with the id ${JSON.stringify(id)}. Use letters, digits, ., - and _.`
        )
      }
      merged.templates.push(packTemplate(catalog, name, label, pack, template))
    }
    for (const question of pack.questions ?? []) {
      const id: unknown = question.id
      if (typeof id !== "string" || !questionIdPattern.test(id) || cliFlags.has(id)) {
        throw new PlanError(
          "E_INVALID_PACK",
          `${label} has a question with the id ${JSON.stringify(id)}. Use lowercase letters, digits and hyphens, and none of the CLI's own flags.`
        )
      }
      if (merged.questions?.some((other) => other.id === id)) {
        throw new PlanError(
          "E_INVALID_PACK",
          `${label} defines question ${id}, which ${catalog.id} or another package has.`
        )
      }
      merged.questions?.push(question)
    }
    // A pack pins only what the catalog doesn't, so the platform's versions are the same in every template.
    for (const [packageName, pin] of Object.entries(pack.versions ?? {})) {
      if (catalog.versions?.[packageName] !== undefined) {
        throw new PlanError(
          "E_INVALID_PACK",
          `${label} pins ${packageName}, which ${catalog.id} pins. A template package can't change the catalog's versions.`
        )
      }
      const other = pinnedBy.get(packageName)
      if (other !== undefined && merged.versions?.[packageName] !== pin) {
        throw new PlanError("E_INVALID_PACK", `${label} and ${other} pin ${packageName} differently.`)
      }
      pinnedBy.set(packageName, label)
      merged.versions = { ...merged.versions, [packageName]: pin }
    }
    for (const addon of pack.addons ?? []) {
      const id: unknown = addon.id
      if (typeof id !== "string" || !id.startsWith(`${name}/`)) {
        throw new PlanError(
          "E_INVALID_PACK",
          `${label} has an add-on with the id ${JSON.stringify(id)}. Its ids start with ${name}/.`
        )
      }
      // Points belong to the catalog's targets and add-ons. One from a pack could rewire the product's own files.
      if ((addon.points ?? []).length > 0) {
        throw new PlanError(
          "E_INVALID_PACK",
          `${label}'s add-on ${id} defines points. A template package can't add them.`
        )
      }
      merged.addons.push(addon)
    }
    merged.packs![name] = { version, ...(integrity === undefined ? {} : { integrity }) }
  }
  const problems = checkCatalog(merged)
  if (problems.length > 0) {
    throw new PlanError(
      "E_INVALID_PACK",
      `${packs.map((loaded) => loaded.name).join(", ")} can't be used with ${catalog.id}: ${problems.join(" ")}`
    )
  }
  return merged
}
