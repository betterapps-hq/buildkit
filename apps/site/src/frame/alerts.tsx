import { alerts, ProjectSettings } from "../examples/alerts/ProjectSettings"
import { format, onCommand, report } from "./bridge"
import { setOffline } from "./server"

function show() {
  const entries = alerts.getSnapshot("settings").map(({ id, intent }) => ({ id, intent }))
  report({ wire: [{ label: 'alerts.getSnapshot("settings")', value: format(entries), tone: "plain" }] })
}

alerts.subscribe(show, "settings")

onCommand((command) => {
  if (command === "online" || command === "offline") {
    setOffline(command === "offline")
  }
})

show()

export function Example() {
  return <ProjectSettings project={{ id: "atlas", name: "Atlas" }} />
}
