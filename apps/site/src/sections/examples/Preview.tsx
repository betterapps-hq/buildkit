import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { isFrameMessage, send, type FrameCommand, type FrameState } from "../../frame/bridge"
import type { Example } from "./content"

/** A reload starts a fresh frame. Routing reloads at the path it was on, the way a browser refresh would. */
type Load = { count: number; path?: string }

/**
 * The example running in its own frame, between a bar with its hint and controls and a wire that shows the state the
 * code is in. The frame loads the first time its example is shown.
 */
export function Preview({ example, active }: { example: Example; active: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [started, setStarted] = useState(active)
  const [state, setState] = useState<FrameState>({ wire: example.wire })
  const [load, setLoad] = useState<Load>({ count: 0 })
  const [offline, setOffline] = useState(false)

  if (active && !started) {
    setStarted(true)
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source === frame.current?.contentWindow && isFrameMessage(event.data)) {
        setState(event.data.state)
      }
    }

    window.addEventListener("message", onMessage)

    return () => window.removeEventListener("message", onMessage)
  }, [])

  function command(name: FrameCommand) {
    const target = frame.current?.contentWindow

    if (target) {
      send(target, name)
    }
  }

  function reload() {
    setOffline(false)
    setLoad({ count: load.count + 1, path: state.route?.path })
  }

  function setNetwork(next: boolean) {
    setOffline(next)
    command(next ? "offline" : "online")
  }

  const params = new URLSearchParams({ example: example.id })

  if (load.path) {
    params.set("path", load.path)
  }

  const route = state.route

  return (
    <div className="ex-preview">
      <div className="ex-preview-bar">
        <span className={offline ? "ex-running is-offline" : "ex-running"} aria-hidden="true" />
        <span className="ex-hint">{example.hint}</span>
        {example.control === "reload" && (
          <button type="button" className="ex-bar-button" onClick={reload}>
            <RotateCw aria-hidden="true" />
            Reload
          </button>
        )}
        {example.control === "refresh" && (
          <button type="button" className="ex-bar-button ex-bar-call" onClick={() => command("refresh")}>
            <RotateCw aria-hidden="true" />
            refresh()
          </button>
        )}
        {example.control === "network" && (
          <fieldset className="ex-network" aria-label="Network">
            <button type="button" aria-pressed={!offline} onClick={() => setNetwork(false)}>
              Online
            </button>
            <button type="button" aria-pressed={offline} onClick={() => setNetwork(true)}>
              Offline
            </button>
          </fieldset>
        )}
      </div>
      {example.control === "browser" && (
        <div className="ex-browser">
          <button type="button" aria-label="Back" disabled={!route?.canGoBack} onClick={() => command("back")}>
            <ArrowLeft aria-hidden="true" />
          </button>
          <button type="button" aria-label="Forward" disabled={!route?.canGoForward} onClick={() => command("forward")}>
            <ArrowRight aria-hidden="true" />
          </button>
          <button type="button" aria-label="Reload" onClick={reload}>
            <RotateCw aria-hidden="true" />
          </button>
          <span className="ex-address">
            <span className="ex-address-host">my-app.localhost</span>
            {route?.path ?? "/people"}
          </span>
        </div>
      )}
      <div className="ex-app">
        {started && (
          <iframe
            key={load.count}
            ref={frame}
            className="ex-frame"
            src={`${import.meta.env.BASE_URL}example.html?${params}`}
            title={`${example.chip} example`}
            loading="lazy"
            onLoad={() => command("sync")}
          />
        )}
      </div>
      <p className="ex-wire" aria-live="polite">
        {state.wire.map((part) => (
          <span key={part.label} className="ex-wire-part">
            <code className="ex-wire-label">{part.label}</code>
            <span className="ex-wire-arrow" aria-hidden="true">
              →
            </span>
            <code className={`ex-wire-value is-${part.tone}`}>{part.value}</code>
          </span>
        ))}
      </p>
    </div>
  )
}
