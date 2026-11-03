/**
 * `@buildkitgg/shadcn-modals-manager` as the modals example sees it in the frame. Its managers report each `confirm()` on
 * the page's wire line: the call waiting, then what it resolved to. The example's own code stays as an app would write
 * it, destructuring `confirm` included.
 */
import { createModalManager as createManager } from "@buildkitgg/shadcn-modals-manager"
import { report, type WirePart } from "./bridge"

export * from "@buildkitgg/shadcn-modals-manager"

function show(part: Omit<WirePart, "label">) {
  report({ wire: [{ label: "confirm()", ...part }] })
}

export function createModalManager(...args: Parameters<typeof createManager>) {
  const manager = createManager(...args)
  const { confirm } = manager
  manager.confirm = (options) => {
    const handle = confirm(options)
    show({ value: "pending", tone: "pending" })
    handle.then((discard) => show({ value: String(discard), tone: "keyword" }))

    return handle
  }

  return manager
}

show({ value: "not called yet", tone: "muted" })
