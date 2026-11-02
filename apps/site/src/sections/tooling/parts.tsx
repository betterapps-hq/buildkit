import { ArrowRight, Check, Copy, type LucideIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Link } from "../../components/Link"

/** Copy that differs between the wide layout and the phone layout, as the two design frames have it. */
export function Alt({ wide, narrow }: { wide: ReactNode; narrow: ReactNode }) {
  return (
    <>
      <span className="tl-wide">{wide}</span>
      {narrow !== "" && <span className="tl-narrow">{narrow}</span>}
    </>
  )
}

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

type BarProps = {
  icon: LucideIcon
  name: string
  pkg: string
  guide: string
  guideLabel: string
}

/** The left-aligned bar that opens each tool's subsection: icon, name over its package, a rule and the guide link. */
export function SubsectionBar({ icon: Icon, name, pkg, guide, guideLabel }: BarProps) {
  return (
    <div className="tl-bar" data-reveal>
      <span className="tl-bar-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="tl-bar-text">
        <span className="tl-bar-name">{name}</span>
        <span className="tl-bar-pkg">{pkg}</span>
      </span>
      <span className="tl-bar-rule" aria-hidden="true" />
      <Link className="tl-bar-guide" href={guide}>
        <span className="tl-bar-guide-label">{guideLabel}</span>
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  )
}
