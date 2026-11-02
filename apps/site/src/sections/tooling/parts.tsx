import { ArrowRight, Check, Copy } from "lucide-react"
import { useState } from "react"
import { Link } from "../../components/Link"

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={className ? `tl-copy ${className}` : "tl-copy"}
      aria-label={copied ? "Copied" : "Copy command"}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          })
          .catch(() => setCopied(false))
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </button>
  )
}

/** A shell command chip with a copy button. `copyClassName` lets a layout hide the button. */
export function Command({ command, copyClassName }: { command: string; copyClassName?: string }) {
  return (
    <div className="tl-command">
      <span className="tl-command-prompt" aria-hidden="true">
        $
      </span>
      <code className="tl-command-text">{command}</code>
      <CopyButton text={command} className={copyClassName} />
    </div>
  )
}

/** The link to a tool's guide that closes its panel. */
export function GuideLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="tl-guide" href={href}>
      {label}
      <ArrowRight aria-hidden="true" />
    </Link>
  )
}
