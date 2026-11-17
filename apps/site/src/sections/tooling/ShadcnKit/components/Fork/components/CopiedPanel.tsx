import { Bot, FileCode, FolderPen, TriangleAlert } from "lucide-react"

/** Where shadcn on its own leaves the component: source in the app, where one edit reaches every screen */
export function CopiedPanel() {
  return (
    <article className="kit-panel kit-panel-copied">
      <header className="kit-panel-head">
        <span className="kit-panel-icon kit-wide">
          <FolderPen aria-hidden="true" />
        </span>
        <Bot className="kit-panel-glyph kit-narrow" aria-hidden="true" />
        <span className="kit-panel-titles">
          <h3 className="kit-panel-title">Copied into src/components/ui</h3>
          <span className="kit-panel-sub kit-wide">Editable by anyone, including your agents</span>
        </span>
        <span className="kit-panel-tag kit-wide">
          <Bot aria-hidden="true" />
          agent edit
        </span>
      </header>
      <div className="kit-panel-body kit-diff">
        <p className="kit-diff-file kit-wide">
          <FileCode aria-hidden="true" />
          src/components/ui/button.tsx
        </p>
        <pre className="kit-diff-code">
          <code>
            <span className="kit-diff-line kit-wide">
              <span className="kit-diff-sign"> </span>
              <span>const buttonVariants = cva(</span>
            </span>
            <span className="kit-diff-line is-removed">
              <span className="kit-diff-sign">-</span>
              <span>
                <span className="kit-wide">{"  "}</span>&quot;<span className="kit-wide">inline-flex </span>h-9
                rounded-md px-4 text-sm&quot;<span className="kit-wide">,</span>
              </span>
            </span>
            <span className="kit-diff-line is-added">
              <span className="kit-diff-sign">+</span>
              <span>
                <span className="kit-wide">{"  "}</span>&quot;<span className="kit-wide">inline-flex </span>h-11
                rounded-full px-6 text-base&quot;<span className="kit-wide">,</span>
              </span>
            </span>
            <span className="kit-diff-line kit-wide">
              <span className="kit-diff-sign"> </span>
              <span>{"  { variants: { size, variant } },"}</span>
            </span>
            <span className="kit-diff-line kit-wide">
              <span className="kit-diff-sign"> </span>
              <span>)</span>
            </span>
          </code>
        </pre>
      </div>
      <p className="kit-panel-foot">
        <TriangleAlert aria-hidden="true" />
        <span>This Button edit affects every screen that uses it.</span>
      </p>
    </article>
  )
}
