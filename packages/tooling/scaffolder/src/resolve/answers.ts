import { findMode, findTarget, targetInfo } from "../manifest/catalog.js"
import type { Answers, CatalogManifest } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { requireTemplate, walkQuestions } from "./questions.js"
import { refuseCombination, requireAddonId, type ResolveIssue, type Selection } from "./resolve.js"

export type AnswersResult = { ok: true; selection: Selection } | { ok: false; issue: ResolveIssue }

/**
 * Turns a template's answers into a selection. Required add-ons are always included. Each asked question that isn't
 * answered takes its default; a required one with no default and more than one available choice comes back as a
 * `choose` issue. A question that isn't asked has no answer. "No" to a question is declined as `question:<id>`, and the
 * choices a `many` question offered and its answer left out are declined by id.
 */
export function selectionFromAnswers(catalog: CatalogManifest, answers: Answers, name: string): AnswersResult {
  const template = requireTemplate(catalog, answers.template)
  const target = findTarget(catalog, template.target)

  if (!target) {
    throw new PlanError(
      "E_UNKNOWN_TARGET",
      `Template ${template.id} uses target "${template.target}", which isn't in the catalog.`
    )
  }

  const { modes } = template

  if (answers.mode !== undefined && !modes.includes(answers.mode)) {
    throw new PlanError("E_USAGE", `${template.title} has no mode "${answers.mode}". Use ${modes.join(" or ")}.`)
  }

  const modeId = answers.mode ?? (modes.length === 1 ? modes[0] : undefined)

  if (modeId === undefined) {
    return { ok: false, issue: { kind: "choose-mode", template: template.id, modes } }
  }

  const mode = findMode(target, modeId)

  if (!mode) {
    throw new PlanError("E_UNKNOWN_TARGET", `${target.title} has no mode "${modeId}".`)
  }

  for (const question of Object.keys(answers.questions ?? {})) {
    if (!template.questions.some((candidate) => candidate.id === question)) {
      throw new PlanError("E_USAGE", `${template.title} has no question "${question}".`)
    }
  }

  const addons: Selection["addons"] = {}
  const declined: string[] = []

  for (const id of template.required) {
    addons[id] = {}
  }

  for (const step of walkQuestions(catalog, template, targetInfo(catalog, target, mode), answers)) {
    const { question } = step

    if (step.choose) {
      return {
        ok: false,
        issue: { kind: "choose", template: template.id, question: question.id, candidates: step.choose }
      }
    }

    if (question.required && step.holds && step.choices.length === 0 && !step.explicit) {
      throw new PlanError(
        "E_UNSUPPORTED",
        `No choice for ${question.title.toLowerCase()} supports ${target.title} (${mode.title}).`
      )
    }

    for (const id of step.answer) {
      addons[id] = {}
    }

    if (!step.explicit && !step.asked) {
      continue
    }

    if (step.answer.length === 0) {
      declined.push(`question:${question.id}`)
    } else if (question.pick === "many") {
      declined.push(...question.choices.map((choice) => choice.id).filter((id) => !step.answer.includes(id)))
    }
  }

  for (const entry of answers.extra ?? []) {
    const id = requireAddonId(catalog, entry)
    refuseCombination(catalog, id)
    addons[id] ??= {}
  }

  for (const [key, options] of Object.entries(answers.options ?? {})) {
    const id = requireAddonId(catalog, key)

    if (!addons[id]) {
      throw new PlanError("E_USAGE", `Options were given for ${id}, but it isn't selected.`)
    }

    addons[id] = { ...addons[id], ...options }
  }

  return {
    ok: true,
    selection: {
      name,
      template: template.id,
      target: { id: target.id, mode: mode.id },
      addons,
      declined: [...new Set(declined)].sort()
    }
  }
}
