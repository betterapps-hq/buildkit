import type { z } from "zod"
import type {
  AddonManifest,
  AddonPack,
  CatalogManifest,
  PointDefinition,
  PresetManifest,
  QuestionDefinition,
  TargetManifest,
  TemplateManifest,
  TemplatePack
} from "./types.js"

/** Identity helpers that give manifests their types. Catalog CI checks them with `checkCatalog()`. */
export function defineAddon<S extends z.ZodType = z.ZodObject<Record<string, never>>>(
  manifest: AddonManifest<S>
): AddonManifest<S> {
  return manifest
}

export function defineTarget(manifest: TargetManifest): TargetManifest {
  return manifest
}

export function defineTemplate(manifest: TemplateManifest): TemplateManifest {
  return manifest
}

export function defineQuestion(question: QuestionDefinition): QuestionDefinition {
  return question
}

export function definePreset(manifest: PresetManifest): PresetManifest {
  return manifest
}

export function definePoint(definition: PointDefinition): PointDefinition {
  return definition
}

export function defineCatalog(manifest: CatalogManifest): CatalogManifest {
  return manifest
}

/** A template package's default export. The engine checks it against the product catalog when it loads it. */
export function definePack(pack: TemplatePack): TemplatePack {
  return pack
}

/** An add-on package's default export. The engine checks it against the product catalog when `add` loads it. */
export function defineAddonPack(pack: AddonPack): AddonPack {
  return pack
}
