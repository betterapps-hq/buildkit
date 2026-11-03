/**
 * Messages between the Examples section and the frames that run each example. A frame reports what its wire line
 * shows (and, for routing, where it is in its history), and the page sends it the commands from the preview bar.
 */
export type ExampleId = "modals" | "preferences" | "alerts" | "routing" | "configuration"

/** How a wire value is colored: strings in mint, keywords in violet, an unsettled call in amber. */
export type WireTone = "plain" | "string" | "keyword" | "pending" | "muted"

export type WirePart = { label: string; value: string; tone: WireTone }

export type FrameRoute = { path: string; canGoBack: boolean; canGoForward: boolean }

export type FrameState = { wire: WirePart[]; route?: FrameRoute }

export type FrameCommand = "sync" | "online" | "offline" | "back" | "forward" | "refresh"

type FrameMessage = { from: "buildkit-example-frame"; state: FrameState }

type PageMessage = { from: "buildkit-example-page"; command: FrameCommand }

/** A value the wire line shows: what the examples read from their stores. */
export type WireValue =
  | string
  | boolean
  | null
  | undefined
  | readonly WireValue[]
  | { readonly [key: string]: WireValue }

export function isFrameMessage(data: unknown): data is FrameMessage {
  return (
    data instanceof Object &&
    "from" in data &&
    data.from === "buildkit-example-frame" &&
    "state" in data &&
    data.state instanceof Object
  )
}

function isFrameCommand(value: unknown): value is FrameCommand {
  return (
    value === "sync" ||
    value === "online" ||
    value === "offline" ||
    value === "back" ||
    value === "forward" ||
    value === "refresh"
  )
}

function isPageMessage(data: unknown): data is PageMessage {
  return (
    data instanceof Object &&
    "from" in data &&
    data.from === "buildkit-example-page" &&
    "command" in data &&
    isFrameCommand(data.command)
  )
}

let latest: FrameState = { wire: [] }

/** Frame side: shows a new state on the page's wire line. */
export function report(state: FrameState) {
  latest = state
  window.parent.postMessage({ from: "buildkit-example-frame", state } satisfies FrameMessage, window.location.origin)
}

/** Frame side: runs the page's commands. `sync` asks for the latest state again, once the frame has loaded. */
export function onCommand(handler: (command: FrameCommand) => void) {
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !isPageMessage(event.data)) {
      return
    }

    if (event.data.command === "sync") {
      report(latest)
    } else {
      handler(event.data.command)
    }
  })
}

/** Page side: sends a command to a frame. */
export function send(frame: Window, command: FrameCommand) {
  frame.postMessage({ from: "buildkit-example-page", command } satisfies PageMessage, window.location.origin)
}

/** Writes a value the way the examples' code would read it: `"fr"`, `true`, `[{ id: "save" }]`. */
export function format(value: WireValue): string {
  if (isKeyword(value)) {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(format).join(", ")}]`
  }

  if (value instanceof Object) {
    const fields = Object.entries(value).map(([key, field]) => `${key}: ${format(field)}`)

    return fields.length ? `{ ${fields.join(", ")} }` : "{}"
  }

  return JSON.stringify(value)
}

/** The tone a formatted value gets on the wire. */
export function toneOf(value: WireValue): WireTone {
  if (isKeyword(value)) {
    return "keyword"
  }

  return value instanceof Object ? "plain" : "string"
}

function isKeyword(value: WireValue): value is boolean | null | undefined {
  return value === true || value === false || value === null || value === undefined
}
