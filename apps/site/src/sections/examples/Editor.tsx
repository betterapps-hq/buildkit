import { Check, Copy, File, FileCode } from "lucide-react"
import { useState, type KeyboardEvent } from "react"
import { tokenize } from "../../components/Code"
import type { Example } from "./content"

/** The example's files as tabs, with the lines that matter tinted. Copy takes the whole file in view. */
export function Editor({ example }: { example: Example }) {
  const [active, setActive] = useState(example.active)
  const [copied, setCopied] = useState(false)
  const file = example.files.find((item) => item.name === active) ?? example.files[0]
  const lines = file.source.replace(/\n$/, "").split("\n")
  const highlight = new Set(file.highlight)
  const tabId = (name: string) => `example-${example.id}-file-${name.replace(/\W/g, "-")}`

  function copy() {
    navigator.clipboard
      .writeText(file.source)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => setCopied(false))
  }

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = example.files.indexOf(file)
    const targets: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: example.files.length - 1
    }
    const target = targets[event.key]
    if (target === undefined) {
      return
    }
    event.preventDefault()
    const next = example.files[(target + example.files.length) % example.files.length]
    setActive(next.name)
    document.getElementById(tabId(next.name))?.focus()
  }

  const CopyIcon = copied ? Check : Copy
  return (
    <div className="ex-editor">
      <div className="ex-files">
        <div
          className="ex-file-tabs"
          role="tablist"
          aria-label={`${example.chip} files`}
          tabIndex={-1}
          onKeyDown={onTabKey}
        >
          {example.files.map((item) => {
            const Icon = item.name.endsWith(".tsx") ? FileCode : File
            const selected = item === file
            return (
              <button
                key={item.name}
                id={tabId(item.name)}
                type="button"
                role="tab"
                className="ex-file"
                aria-selected={selected}
                aria-controls={`example-${example.id}-source`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(item.name)}
              >
                <Icon aria-hidden="true" />
                {item.name}
              </button>
            )
          })}
        </div>
        <button type="button" className="ex-copy ex-copy-bar" onClick={copy}>
          <CopyIcon aria-hidden="true" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        id={`example-${example.id}-source`}
        className="ex-source"
        role="tabpanel"
        aria-labelledby={tabId(file.name)}
        tabIndex={0}
      >
        <code>
          {lines.map((line, index) => (
            <span key={index} className={highlight.has(index + 1) ? "ex-line is-highlighted" : "ex-line"}>
              <span className="ex-line-no" aria-hidden="true">
                {index + 1}
              </span>
              <span className="ex-line-text">
                {tokenize(line).map((token, tokenIndex) => (
                  <span key={tokenIndex} className={`tok-${token.kind}`}>
                    {token.text}
                  </span>
                ))}
                {line === "" && " "}
              </span>
            </span>
          ))}
        </code>
      </pre>
      <button type="button" className="ex-copy ex-copy-row" onClick={copy}>
        <CopyIcon aria-hidden="true" />
        {copied ? "Copied" : `Copy ${file.name}`}
      </button>
    </div>
  )
}
