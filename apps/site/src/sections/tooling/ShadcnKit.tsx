import { Bot, FileCode, FolderPen, Lock, PackageCheck, Palette, ShieldCheck, TriangleAlert } from "lucide-react"
import { packageGuide } from "../../links"
import "../shadcn-kit.css"
import { GuideLink } from "./parts"

const STYLES = ["vega", "nova", "maia", "lyra", "mira", "luma", "rhea", "sera"] as const

type Style = (typeof STYLES)[number]

function StyleToken({ style }: { style: Style }) {
  return <span className="kit-token">{style}</span>
}

function CopiedPanel() {
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

function InstalledPanel() {
  return (
    <article className="kit-panel kit-panel-installed">
      <header className="kit-panel-head">
        <span className="kit-panel-icon kit-wide">
          <PackageCheck aria-hidden="true" />
        </span>
        <Lock className="kit-panel-glyph kit-narrow" aria-hidden="true" />
        <span className="kit-panel-titles">
          <h3 className="kit-panel-title">Built into node_modules</h3>
          <span className="kit-panel-sub kit-wide">Stock shadcn, compiled from a snapshot you commit</span>
        </span>
        <span className="kit-panel-tag kit-wide">
          <Lock aria-hidden="true" />
          generated
        </span>
      </header>
      <ul className="kit-panel-body kit-files">
        <li className="kit-file is-sealed">
          <Lock aria-hidden="true" />
          <span className="kit-file-path">node_modules/@buildkitgg/shadcn</span>
          <span className="kit-file-note kit-wide">as shadcn ships it</span>
        </li>
        <li className="kit-file kit-wide">
          <FileCode aria-hidden="true" />
          <span className="kit-file-path">src/app.tsx</span>
          <span className="kit-file-note">import {"{ Button }"} from &quot;@buildkitgg/shadcn&quot;</span>
        </li>
        <li className="kit-file is-theme">
          <Palette aria-hidden="true" />
          <span className="kit-file-path">src/theme.css</span>
          <span className="kit-file-note kit-wide">--radius: 0.625rem;{"  "}--primary: …</span>
        </li>
      </ul>
      <p className="kit-panel-foot">
        <ShieldCheck aria-hidden="true" />
        <span>Customize with CSS variables, and pull new components with one command</span>
      </p>
    </article>
  )
}

export function ShadcnKit() {
  return (
    <div className="tl-sub">
      <div className="kit-head">
        <div className="kit-heading">
          <h3 className="tl-heading">
            shadcn as a package,
            <br className="kit-wide" /> not a folder to edit
          </h3>
          <p className="tl-body">
            Editing a shared component can affect every screen that uses it. shadcn-sync runs the shadcn CLI for the
            primitives, style, theme and icons you pick, then builds the components into a package in your app.
            Customize them with CSS variables and keep the code stock.
          </p>
        </div>
        <pre className="kit-install kit-wide">
          <code>
            <span className="kit-install-line">
              <span className="kit-prompt">$ </span>
              pnpm dlx @buildkitgg/shadcn-sync --style <StyleToken style="vega" />
            </span>
            <span className="kit-install-line">
              <span className="tok-kw">import</span>
              <span className="tok-punc">{" { Button } "}</span>
              <span className="tok-kw">from</span>
              <span className="tok-str"> &quot;@buildkitgg/shadcn&quot;</span>
            </span>
          </code>
        </pre>
      </div>

      <div className="kit-compare">
        <CopiedPanel />
        <InstalledPanel />
      </div>

      <div className="kit-styles">
        <div className="kit-styles-head">
          <h4 className="tl-part-title">Pick one of eight shadcn styles</h4>
          <p className="kit-styles-note">Switch with shadcn-sync set --style. Imports and managers stay the same.</p>
        </div>
        <ul className="kit-style-list" aria-label="shadcn styles">
          {STYLES.map((style) => (
            <li key={style} className={style === "vega" ? "is-shown" : undefined}>
              {style}
            </li>
          ))}
        </ul>
      </div>

      <GuideLink href={packageGuide("shadcn-sync")} label="shadcn-sync guide" />
    </div>
  )
}
