import {
  expandTemplate,
  findAddon,
  findTarget,
  lookupAddon,
  type ExpandedQuestion,
  type ExpandedTemplate
} from "../manifest/catalog.js"
import type { CatalogManifest } from "../manifest/types.js"
import type { ResolveIssue, Selection } from "../resolve/resolve.js"
import { requestArgv } from "./argv.js"
import type { DecisionChoice, Intent, PlanDecision, PlanRequest } from "./types.js"

function title(catalog: CatalogManifest, id: string): string {
  return findAddon(catalog, id)?.title ?? id
}

function withIntent(request: PlanRequest, intent: Intent): PlanRequest {
  return { ...request, intent }
}

/** The template's question that offers an add-on. A template offers each add-on in one question at most. */
function offering(template: ExpandedTemplate | undefined, id: string): ExpandedQuestion | undefined {
  return template?.questions.find((question) => question.choices.some((choice) => choice.id === id))
}

/** True when a name in a request is the add-on itself, by id or short name, or the question that offers it. */
function refersTo(catalog: CatalogManifest, template: ExpandedTemplate | undefined, name: string, id: string): boolean {
  const lookup = lookupAddon(catalog, name)
  if ("id" in lookup) {
    return lookup.id === id
  }
  return offering(template, id)?.id === name
}

/**
 * Adds an add-on to whatever the request asks for, so the choice resolves without asking again. For `create`, it
 * answers the question that offers it, or goes in `extra`.
 */
function addingTo(
  catalog: CatalogManifest,
  request: PlanRequest,
  template: ExpandedTemplate | undefined,
  id: string,
  replace?: string
): PlanRequest {
  const { intent } = request
  if (intent.command === "init") {
    const { answers } = intent
    const question = offering(template, id)
    const kept = (ids: readonly string[]) => ids.filter((entry) => entry !== replace && entry !== id)
    const questions = Object.fromEntries(
      Object.entries(answers.questions ?? {}).map(([key, ids]): [string, string[]] => [key, kept(ids)])
    )
    if (question) {
      const current = answers.questions?.[question.id] ?? question.default
      questions[question.id] = question.pick === "one" ? [id] : [...kept(current), id]
    }
    const extra = [...kept(answers.extra ?? []), ...(question ? [] : [id])]
    return withIntent(request, {
      command: "init",
      answers: {
        ...answers,
        ...(Object.keys(questions).length > 0 ? { questions } : {}),
        ...(extra.length > 0 ? { extra } : {})
      }
    })
  }
  if (intent.command === "add") {
    return withIntent(request, {
      ...intent,
      addons: [...intent.addons.filter((name) => !refersTo(catalog, template, name, id)), id],
      replace: replace === undefined ? intent.replace : [...new Set([...intent.replace, replace])]
    })
  }
  if (replace === undefined) {
    // Stay the same command: an upgrade turned into an add would stop at the catalog-mismatch check.
    return withIntent(request, {
      ...intent,
      addons: [...(intent.addons ?? []).filter((name) => !refersTo(catalog, template, name, id)), id]
    })
  }
  return withIntent(request, { command: "add", addons: [id], replace: [replace], options: {} })
}

/** The template the request is for: the project's, the one a `choose` issue names, or the one `create` asks for. */
function issueTemplate(
  catalog: CatalogManifest,
  request: PlanRequest,
  issue: ResolveIssue,
  selection: Selection | undefined
): ExpandedTemplate | undefined {
  const { intent } = request
  let id = selection?.template
  if (issue.kind === "choose") {
    id ??= issue.template
  } else if (intent.command === "init") {
    id ??= intent.answers.template
  }
  return id === undefined ? undefined : expandTemplate(catalog, id)
}

/**
 * Turns a resolver issue into a decision whose every choice is a complete request. `selection` is what the request
 * resolved from, when it got that far.
 */
export function issueDecision(
  catalog: CatalogManifest,
  request: PlanRequest,
  issue: ResolveIssue,
  selection?: Selection
): PlanDecision {
  const { intent } = request
  const template = issueTemplate(catalog, request, issue, selection)
  switch (issue.kind) {
    case "choose-mode": {
      const target = template ? findTarget(catalog, template.target) : undefined
      const choices: DecisionChoice[] =
        intent.command === "init"
          ? issue.modes.map((mode) => ({
              id: mode,
              label: target?.modes.find((candidate) => candidate.id === mode)?.title ?? mode,
              request: withIntent(request, { command: "init", answers: { ...intent.answers, mode } })
            }))
          : []
      return { id: "mode", message: `Which mode should ${template?.title ?? issue.template} use?`, choices }
    }
    case "choose": {
      const question = (expandTemplate(catalog, issue.template) ?? template)?.questions.find(
        (candidate) => candidate.id === issue.question
      )
      return {
        id: `question:${issue.question}`,
        message: `Which ${(question?.title ?? issue.question).toLowerCase()}?`,
        choices: issue.candidates.map((id) => ({
          id,
          label: title(catalog, id),
          request: addingTo(catalog, request, template, id)
        }))
      }
    }
    case "choose-provider": {
      // A question of the template that offers the candidates names what's needed, as "a database".
      const question = issue.candidates.map((id) => offering(template, id)).find((found) => found !== undefined)
      const needs = question
        ? `a ${question.title.toLowerCase()}. ${question.choose ?? `Which ${question.title.toLowerCase()}?`}`
        : `an add-on that provides ${issue.capability}. Which one?`
      return {
        id: `provides:${issue.capability}`,
        message: `${title(catalog, issue.by)} needs ${needs}`,
        choices: issue.candidates.map((id) => ({
          id,
          label: title(catalog, id),
          request: addingTo(catalog, request, template, id)
        }))
      }
    }
    case "conflicts": {
      const id = `conflicts:${issue.addon}`
      // A conflict over a capability is a swap when the request names one of the two: it replaces the other.
      const names = intent.command === "init" ? [] : (intent.addons ?? [])
      const named = [issue.addon, issue.other].filter((addon) =>
        names.some((name) => refersTo(catalog, template, name, addon))
      )
      const [incoming] = named
      const installed = incoming === issue.addon ? issue.other : issue.addon
      if (issue.capability === undefined || incoming === undefined || named.length > 1) {
        return {
          id,
          message: `${title(catalog, issue.addon)} can't be used with ${title(catalog, issue.other)}. Remove one of them from the config.`,
          choices: []
        }
      }
      // The noun is the title of the template's question that offers both, else the capability.
      const question = offering(template, installed)
      const noun =
        question && question.id === offering(template, incoming)?.id ? question.title.toLowerCase() : issue.capability
      const lead = Object.hasOwn(findAddon(catalog, installed)?.provides ?? {}, issue.capability)
        ? `${title(catalog, installed)} is your ${noun}.`
        : `${title(catalog, installed)} can't be used with an add-on that provides ${issue.capability}.`
      // Only an add-on chosen in the config can be replaced, and only when nothing else requires it: an add-on that does
      // would pull it straight back in.
      const needers = Object.keys(selection?.addons ?? {})
        .filter((other) => other !== installed && findAddon(catalog, other)?.requires?.includes(installed))
        .map((other) => title(catalog, other))
      if (selection && (needers.length > 0 || !Object.hasOwn(selection.addons, installed))) {
        return {
          id,
          message: `${lead} ${needers.length > 0 ? needers.join(" and ") : "Another add-on"} needs it, so it can't be replaced with ${title(catalog, incoming)}.`,
          choices: []
        }
      }
      // A replacement is an add. Turning an upgrade into one would drop the upgrade, so other commands say how instead.
      if (intent.command !== "add") {
        // requestArgv keeps full ids where two add-ons share a short name, so the command always resolves.
        const command = requestArgv(
          { intent: { command: "add", addons: [incoming], replace: [installed], options: {} } },
          { catalog }
        ).join(" ")
        return {
          id,
          message: `${lead} To replace it with ${title(catalog, incoming)}, run ${command}.`,
          choices: []
        }
      }
      return {
        id,
        message: `${lead} Replace it with ${title(catalog, incoming)}?`,
        choices: [
          {
            id: "replace",
            label: `Replace ${title(catalog, installed)}`,
            request: addingTo(catalog, request, template, incoming, installed)
          }
        ]
      }
    }
  }
}
