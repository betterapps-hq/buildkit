import { z } from "zod"
import { allAddons, lookupAddon, shortName } from "../manifest/catalog.js"
import type { Answers, CatalogManifest, PresetManifest } from "../manifest/types.js"
import { compareText } from "./json.js"
import type { PlanRequest } from "./types.js"

/** Options keyed by add-on id, as answers and intents hold them. */
type Options = NonNullable<Answers["options"]>

/** One add-on's options, keyed by option name. */
type AddonOptions = Options[string]

const optionText = z.string()

/**
 * How a command names add-ons. A flag uses the short name, or the full id where the catalog has two add-ons with that
 * short name, and a bare add-on's package name. Two names are the same add-on when the catalog resolves them to one id
 * or, without the catalog, when their short names match.
 */
interface AddonNames {
  flag(name: string): string
  key(name: string): string
}

function addonNames(catalog: CatalogManifest | undefined): AddonNames {
  const bare = (id: string) => (id.startsWith("npm:") ? id.slice(4) : undefined)

  if (!catalog) {
    return { flag: (name) => bare(name) ?? shortName(name), key: (name) => bare(name) ?? shortName(name) }
  }

  const counts = new Map<string, number>()

  for (const { id } of allAddons(catalog).filter((addon) => !addon.id.startsWith("npm:"))) {
    counts.set(shortName(id), (counts.get(shortName(id)) ?? 0) + 1)
  }

  const key = (name: string) => {
    const found = lookupAddon(catalog, name)

    return "id" in found ? found.id : name
  }

  return {
    flag: (name) => {
      const id = key(name)

      return bare(id) ?? ((counts.get(shortName(id)) ?? 0) > 1 ? id : shortName(id))
    },
    key
  }
}

/** A `--set` value: a string as it is, anything else as JSON. */
function optionValue(value: AddonOptions[string]): string {
  const text = optionText.safeParse(value)

  return text.success ? text.data : JSON.stringify(value)
}

function setFlags(options: Options, names: AddonNames): string[] {
  return Object.entries(options)
    .sort(([left], [right]) => compareText(left, right))
    .flatMap(([id, values]) =>
      Object.entries(values).flatMap(([key, value]) => ["--set", `${names.flag(id)}.${key}=${optionValue(value)}`])
    )
}

/** Options by the add-on they belong to, however the add-on is named. */
function optionsByAddon(options: Options, names: AddonNames): Map<string, AddonOptions> {
  return new Map(Object.entries(options).map(([id, values]) => [names.key(id), values]))
}

/** Options that differ from a preset's, by add-on and key. */
function changedOptions(options: Options, preset: Options, names: AddonNames): Options {
  const presetOptions = optionsByAddon(preset, names)

  return Object.fromEntries(
    Object.entries(options)
      .map(([id, values]): [string, AddonOptions] => [
        id,
        Object.fromEntries(
          Object.entries(values).filter(
            ([key, value]) => JSON.stringify(value) !== JSON.stringify(presetOptions.get(names.key(id))?.[key])
          )
        )
      ])
      .filter(([, values]) => Object.keys(values).length > 0)
  )
}

/**
 * Whether the answers answer every question the preset does. One they leave to the template's default can't be written
 * as a difference from the preset, because `--preset` answers it.
 */
function answersPreset(answers: Answers, preset: Answers, names: AddonNames): boolean {
  const options = optionsByAddon(answers.options ?? {}, names)

  return (
    (preset.mode === undefined || answers.mode !== undefined) &&
    (preset.extra === undefined || answers.extra !== undefined) &&
    Object.keys(preset.questions ?? {}).every((question) => answers.questions?.[question] !== undefined) &&
    Object.entries(preset.options ?? {}).every(([id, values]) =>
      Object.keys(values).every((key) => options.get(names.key(id))?.[key] !== undefined)
    )
  )
}

/** Whether a preset's answer to a question is the request's: the same add-ons, however they're named. */
function sameAnswer(preset: readonly string[] | undefined, answer: readonly string[], names: AddonNames): boolean {
  const keys = (ids: readonly string[]) => [...new Set(ids.map((id) => names.key(id)))].sort().join(" ")

  return preset !== undefined && keys(preset) === keys(answer)
}

/**
 * The CLI arguments that make the same request, without the product's own name. With `preset`, a `create` for that
 * preset's template that answers every question the preset does is written as `create --preset <id>` plus flags for the
 * answers that differ from the preset's. Each answered question is written as `--<question>` or `--no-<question>`, and
 * `extra` as `--with`. With `catalog`, an add-on whose short name another add-on shares is written by its full id.
 * A catalog of another version than the request's isn't used, since its defaults and add-ons can differ.
 */
export function requestArgv(
  request: PlanRequest,
  options: { preset?: PresetManifest; catalog?: CatalogManifest } = {}
): string[] {
  const catalog =
    options.catalog && (request.catalogVersion === undefined || request.catalogVersion === options.catalog.version)
      ? options.catalog
      : undefined

  const names = addonNames(catalog)
  const { intent } = request
  const argv: string[] = []

  switch (intent.command) {
    case "init": {
      const { answers } = intent

      const preset =
        options.preset?.answers.template === answers.template && answersPreset(answers, options.preset.answers, names)
          ? options.preset
          : undefined

      const name = answers.name === undefined ? [] : [answers.name]
      argv.push("create", ...(preset ? ["--preset", preset.id] : [answers.template]), ...name)

      if (answers.mode !== undefined && answers.mode !== preset?.answers.mode) {
        argv.push("--mode", answers.mode)
      }

      for (const [question, answer] of Object.entries(answers.questions ?? {})) {
        if (preset && sameAnswer(preset.answers.questions?.[question], answer, names)) {
          continue
        }

        argv.push(
          ...(answer.length === 0
            ? [`--no-${question}`]
            : [`--${question}`, answer.map((id) => names.flag(id)).join(",")])
        )
      }

      const presetExtra = new Set((preset?.answers.extra ?? []).map((id) => names.key(id)))

      for (const id of answers.extra ?? []) {
        if (!presetExtra.has(names.key(id))) {
          argv.push("--with", names.flag(id))
        }
      }

      argv.push(...setFlags(changedOptions(answers.options ?? {}, preset?.answers.options ?? {}, names), names))

      if (answers.adopt) {
        argv.push("--adopt")
      }

      break
    }

    case "add":
      argv.push("add", ...intent.addons.map((id) => names.flag(id)))

      for (const id of intent.replace) {
        argv.push("--replace", names.flag(id))
      }

      argv.push(...setFlags(intent.options, names))
      break
    case "config":
      argv.push("config", "set", ...setFlags(intent.options, names).filter((_, index) => index % 2 === 1))
      argv.push(...(intent.addons ?? []).flatMap((id) => ["--with", names.flag(id)]))
      break
    case "upgrade":
    case "sync":
      argv.push(intent.command, ...(intent.addons ?? []).flatMap((id) => ["--with", names.flag(id)]))
      break
  }

  for (const [id, resolution] of Object.entries(request.resolve ?? {})) {
    argv.push(
      "--resolve",
      `${id}=${resolution === "keep-current" || resolution === "take-incoming" ? resolution : "file:<path>"}`
    )
  }

  if (request.conflictStyle === "markers") {
    argv.push("--conflict", "markers")
  }

  if (request.catalogVersion !== undefined) {
    argv.push("--catalog-version", request.catalogVersion)
  }

  return argv
}
