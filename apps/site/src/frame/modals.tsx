import { modals, ProjectNameForm } from "../examples/modals/ProjectNameForm"
import { report, type WirePart } from "./bridge"

function show(part: Omit<WirePart, "label">) {
  report({ wire: [{ label: "modals.confirm()", ...part }] })
}

// Watches confirm, so the wire shows the call waiting and then what it resolved to
const confirm = modals.confirm.bind(modals)
modals.confirm = (options) => {
  const handle = confirm(options)
  show({ value: "pending", tone: "pending" })
  handle.then((discard) => show({ value: String(discard), tone: "keyword" }))
  return handle
}

show({ value: "not called yet", tone: "muted" })

export function Example() {
  return <ProjectNameForm savedName="Atlas Mobile" />
}
