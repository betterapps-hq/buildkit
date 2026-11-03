import { ArrowUpRight, ChevronRight, CodeXml, Play } from "lucide-react"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Link } from "../components/Link"
import type { ExampleId } from "../frame/bridge"
import { links, packageGuide } from "../links"
import { EXAMPLES, type Example } from "./examples/content"
import { Editor } from "./examples/Editor"
import { Preview } from "./examples/Preview"
import "./examples.css"

/**
 * One example behind its tab: the packages it uses, what it does, and the running example beside its code. Phones and
 * tablets show the running example or the code, one at a time.
 */
function Slide({ example, active }: { example: Example; active: boolean }) {
  const [view, setView] = useState<"preview" | "code">("preview")

  return (
    <div
      id={`example-${example.id}`}
      role="tabpanel"
      aria-labelledby={`example-${example.id}-tab`}
      className={active ? "ex-card is-active" : "ex-card"}
      data-example={example.id}
      data-view={view}
    >
      <div className="ex-side">
        <div className="ex-head">
          <ul className="ex-layers" aria-label="Packages">
            {example.layers.map((layer, index) => (
              <li key={layer.name}>
                {index > 0 && <ChevronRight className="ex-layer-step" aria-hidden="true" />}
                <Link className="ex-layer" href={packageGuide(layer.name)}>
                  <span className="ex-layer-role">{layer.role}</span>
                  <span className="ex-layer-name">{layer.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <h3 className="ex-title">{example.title}</h3>
          <p className="ex-desc">{example.description}</p>
        </div>
        <fieldset className="ex-views" aria-label={`${example.chip} view`}>
          <button type="button" aria-pressed={view === "preview"} onClick={() => setView("preview")}>
            <Play aria-hidden="true" />
            Preview
          </button>
          <button type="button" aria-pressed={view === "code"} onClick={() => setView("code")}>
            <CodeXml aria-hidden="true" />
            Code
          </button>
        </fieldset>
        <Preview example={example} active={active} />
      </div>
      <Editor example={example} />
    </div>
  )
}

export function Examples() {
  const [active, setActive] = useState<ExampleId>("modals")
  const section = useRef<HTMLElement>(null)
  const tabs = useRef<HTMLDivElement>(null)

  // While the scroll story runs, it says which example is in view
  useEffect(() => {
    const element = section.current

    function onShow(event: Event) {
      // SAFETY: the scroll story sends the data-example of the card in view, and the cards are rendered from ExampleIds.
      setActive((event as CustomEvent<ExampleId>).detail)
    }

    element?.addEventListener("examples:show", onShow)

    return () => element?.removeEventListener("examples:show", onShow)
  }, [])

  // On phones the tabs scroll sideways, so the active one is brought into view
  useEffect(() => {
    const row = tabs.current
    const tab = row?.querySelector<HTMLElement>('[aria-selected="true"]')

    if (row && tab && row.scrollWidth > row.clientWidth) {
      row.scrollTo({ left: tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" })
    }
  }, [active])

  /** Shows an example. The scroll story takes the request when it runs, and scrolls to that example. */
  function select(id: ExampleId) {
    const request = new CustomEvent("examples:go", { detail: id, cancelable: true })

    if (section.current?.dispatchEvent(request) !== false) {
      setActive(id)
    }
  }

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = EXAMPLES.findIndex((example) => example.id === active)

    const targets = new Map([
      ["ArrowLeft", index - 1],
      ["ArrowRight", index + 1],
      ["Home", 0],
      ["End", EXAMPLES.length - 1]
    ])

    const target = targets.get(event.key)

    if (target === undefined) {
      return
    }

    event.preventDefault()
    const example = EXAMPLES[(target + EXAMPLES.length) % EXAMPLES.length]
    select(example.id)
    document.getElementById(`example-${example.id}-tab`)?.focus()
  }

  return (
    <section ref={section} id="examples" className="section section-ruled examples" aria-labelledby="examples-title">
      <div className="container examples-inner">
        <div className="examples-heading" data-reveal-stagger>
          <p className="eyebrow">Examples</p>
          <h2 id="examples-title" className="section-title examples-title">
            The parts every app rebuilds, already built and typed
          </h2>
          <p className="section-body examples-body">
            Core packages manage behavior; bindings and adapters connect it to your app. These examples show how the
            layers work together with your components.
          </p>
        </div>
        <div className="examples-stage">
          <div className="examples-bar" data-reveal>
            <div
              ref={tabs}
              className="examples-chips"
              role="tablist"
              aria-label="Examples"
              tabIndex={-1}
              onKeyDown={onTabKey}
            >
              {EXAMPLES.map((example) => (
                <button
                  key={example.id}
                  id={`example-${example.id}-tab`}
                  type="button"
                  role="tab"
                  className="examples-chip"
                  aria-selected={example.id === active}
                  aria-controls={`example-${example.id}`}
                  tabIndex={example.id === active ? 0 : -1}
                  onClick={() => select(example.id)}
                >
                  {example.chip}
                </button>
              ))}
            </div>
            <Link className="text-link examples-storybook" href={links.storybook}>
              Open every example in Storybook
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
          <div className="examples-track" data-reveal>
            {EXAMPLES.map((example) => (
              <Slide key={example.id} example={example} active={example.id === active} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
