import { TextSizePicker } from "../examples/preferences/TextSizePicker"
import { report } from "./bridge"

function show() {
  const saved = window.localStorage.getItem("preferences")
  report({
    wire: [{ label: "localStorage.preferences", value: saved ?? "null", tone: saved === null ? "keyword" : "string" }]
  })
}

// The store saves on its own, so writes to storage keep the wire current
const setItem = Storage.prototype.setItem

Storage.prototype.setItem = function (key, value) {
  setItem.call(this, key, value)
  show()
}

const removeItem = Storage.prototype.removeItem

Storage.prototype.removeItem = function (key) {
  removeItem.call(this, key)
  show()
}

show()

export function Example() {
  return <TextSizePicker />
}
