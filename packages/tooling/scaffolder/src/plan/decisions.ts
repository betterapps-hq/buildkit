import { findAddon, findSlot, findTarget, findTemplate, lookupAddon } from "../manifest/catalog.js"
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

/** True when a name in a request is the add-on itself, by id or short name, or the slot it fills. */
function refersTo(catalog: CatalogManifest, name: string, id: string): boolean {
  const lookup = lookupAddon(catalog, name)
  if ("id" in lookup) {
    return lookup.id === id
  }
  const slot = findSlot(catalog, name)
  return slot !== undefined && findAddon(catalog, id)?.slot === slot.id
}

/** Adds an add-on to whatever the request asks for, so the choice resolves without asking again. */
function addingTo(catalog: CatalogManifest, request: PlanRequest, id: string, replace?: string): PlanRequest {
  const { intent } = request
  if (intent.command === "init") {
    const slot = findAddon(catalog, id)?.slot
    const answered =
      slot !== undefined &&
      (findTemplate(catalog, intent.answers.template)?.slots?.[slot] !== undefined ||
        intent.answers.slots?.[slot] !== undefined)
    const optional = (intent.answers.optional ?? []).filter((entry) => entry !== replace && entry !== id)
    return withIntent(request, {
      command: "init",
      answers:
        answered && slot !== undefined
          ? { ...intent.answers, optional, slots: { ...intent.answers.slots, [slot]: id } }
          : { ...intent.answers, optional: [...optional, id] }
    })
  }
  if (intent.command === "add") {
    return withIntent(request, {
      ...intent,
      addons: [...intent.addons.filter((name) => !refersTo(catalog, name, id)), id],
      replace: replace === undefined ? intent.replace : [...new Set([...intent.replace, replace])]
    })
  }
  if (replace === undefined) {
    // Stay the same command: an upgrade turned into an add would stop at the catalog-mismatch check.
    return withIntent(request, {
      ...intent,
      addons: [...(intent.addons ?? []).filter((name) => !refersTo(catalog, name, id)), id]
    })
  }
  return withIntent(request, { command: "add", addons: [id], replace: [replace], options: {} })
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
  switch (issue.kind) {
    case "choose-mode": {
      const template = findTemplate(catalog, issue.template)
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
    case "choose-slot": {
      const slot = findSlot(catalog, issue.slot)
      const lead = issue.by ? `${title(catalog, issue.by)} needs a ${slot?.title.toLowerCase() ?? issue.slot}. ` : ""
      return {
        id: `slot:${issue.slot}`,
        message: `${lead}${slot?.choose ?? `Choose a ${issue.slot}.`}`,
        choices: issue.candidates.map((id) => ({
          id,
          label: title(catalog, id),
          request: addingTo(catalog, request, id)
        }))
      }
    }
    case "choose-provider":
      return {
        id: `provides:${issue.capability}`,
        message: `${title(catalog, issue.by)} needs an add-on that provides ${issue.capability}. Which one?`,
        choices: issue.candidates.map((id) => ({
          id,
          label: title(catalog, id),
          request: addingTo(catalog, request, id)
        }))
      }
    case "slot-taken": {
      const slot = findSlot(catalog, issue.slot)
      return {
        id: `slot:${issue.slot}`,
        message: `${title(catalog, issue.installed)} is already the ${slot?.title.toLowerCase() ?? issue.slot}. Replace it with ${title(catalog, issue.incoming)}?`,
        choices: [
          {
            id: "replace",
            label: `Replace ${title(catalog, issue.installed)}`,
            request: addingTo(catalog, request, issue.incoming, issue.installed)
          }
        ]
      }
    }
    case "conflicts": {
      const id = `conflicts:${issue.addon}`
      // A conflict over a capability is a swap when the request names one of the two: it replaces the other.
      const names = intent.command === "init" ? [] : (intent.addons ?? [])
      const named = [issue.addon, issue.other].filter((addon) => names.some((name) => refersTo(catalog, name, addon)))
      const [incoming] = named
      const installed = incoming === issue.addon ? issue.other : issue.addon
      if (issue.capability === undefined || incoming === undefined || named.length > 1) {
        return {
          id,
          message: `${title(catalog, issue.addon)} can't be used with ${title(catalog, issue.other)}. Remove one of them from the config.`,
          choices: []
        }
      }
      const lead = Object.hasOwn(findAddon(catalog, installed)?.provides ?? {}, issue.capability)
        ? `${title(catalog, installed)} is your ${issue.capability}.`
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
            request: addingTo(catalog, request, incoming, installed)
          }
        ]
      }
    }
  }
}
