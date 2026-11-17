import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export type Stage = { icon: LucideIcon; name: string; detail: string; shared?: boolean }

type PathProps = {
  tone: "copy" | "sync"
  verdict: ReactNode
  command: string
  label: string
  stages: Stage[]
  children: ReactNode
}

/**
 * One way to get the component: a verdict, the command, what it does in order, and where the component ends up. The
 * verdict's words, icon and fill, and the wire's line, tell the paths apart without their colors.
 */
export function Path({ tone, verdict, command, label, stages, children }: PathProps) {
  return (
    <div className={`kit-path is-${tone}`}>
      <div className="kit-branch">
        <span className="kit-wire" aria-hidden="true" />
        <span className="kit-verdict">{verdict}</span>
        <span className="kit-wire" aria-hidden="true" />
        <code className="kit-cmd">
          <span className="kit-prompt">$ </span>
          {command}
        </code>
        <span className="kit-wire" aria-hidden="true" />
        <ol className="kit-stages" aria-label={label}>
          {stages.map(({ icon: Icon, name, detail, shared }) => (
            <li key={name} className={shared ? "kit-stage is-shared" : "kit-stage"}>
              <span className="kit-stage-name">
                <Icon aria-hidden="true" />
                {name}
              </span>
              <code className="kit-stage-detail">{detail}</code>
            </li>
          ))}
        </ol>
        <span className="kit-wire kit-wire-in" aria-hidden="true" />
      </div>
      {children}
    </div>
  )
}
