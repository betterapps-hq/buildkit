import {
  ArrowRight,
  Bot,
  Braces,
  FileCode,
  FolderPen,
  Layers,
  Lock,
  PackageCheck,
  Paintbrush,
  Palette,
  ShieldCheck,
  TriangleAlert
} from "lucide-react"
import { Link } from "../components/Link"
import "./shadcn-kit.css"
import { packageGuide } from "../links"

const STYLES = ["vega", "nova", "maia", "lyra", "mira", "luma", "rhea", "sera"] as const

type Style = (typeof STYLES)[number]

const title = (style: Style) => style.charAt(0).toUpperCase() + style.slice(1)

/** A small form drawn in one upstream style: tabs, an email field and Invite button, a slider, a switch and a badge. */
function Specimen() {
  return (
    <span className="kit-specimen" aria-hidden="true">
      <span className="kit-sp-tabs">
        <span className="kit-sp-tab is-active">Account</span>
        <span className="kit-sp-tab">Billing</span>
      </span>
      <span className="kit-sp-field">
        <span className="kit-sp-input">ada@acme.dev</span>
        <span className="kit-sp-button">Invite</span>
      </span>
      <span className="kit-sp-slider">
        <span className="kit-sp-range" />
        <span className="kit-sp-knob" />
        <span className="kit-sp-rest" />
      </span>
      <span className="kit-sp-row">
        <span className="kit-sp-switch">
          <span className="kit-sp-thumb" />
        </span>
        <span className="kit-sp-switch-label">Allow guests</span>
        <span className="kit-sp-badge">Admin</span>
      </span>
    </span>
  )
}

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
          <h3 className="kit-panel-title">Installed from npm</h3>
          <span className="kit-panel-sub kit-wide">Compiled and versioned, installed in node_modules.</span>
        </span>
        <span className="kit-panel-tag kit-wide">
          <Lock aria-hidden="true" />
          versioned
        </span>
      </header>
      <ul className="kit-panel-body kit-files">
        <li className="kit-file is-sealed">
          <Lock aria-hidden="true" />
          <span className="kit-file-path">node_modules/@buildkitgg/shadcn-baseui-kit</span>
          <span className="kit-file-note kit-wide">as published</span>
        </li>
        <li className="kit-file kit-wide">
          <FileCode aria-hidden="true" />
          <span className="kit-file-path">src/app.tsx</span>
          <span className="kit-file-note">import {"{ Button }"} from &quot;…/shadcn-baseui-kit&quot;</span>
        </li>
        <li className="kit-file is-theme">
          <Palette aria-hidden="true" />
          <span className="kit-file-path">src/theme.css</span>
          <span className="kit-file-note kit-wide">--radius: 0.625rem;{"  "}--primary: …</span>
        </li>
      </ul>
      <p className="kit-panel-foot">
        <ShieldCheck aria-hidden="true" />
        <span>Customize with CSS variables, and update it like any other dependency</span>
      </p>
    </article>
  )
}

export function ShadcnKit() {
  return (
    <section id="shadcn" className="section kit" aria-labelledby="kit-title">
      <div className="container kit-inner">
        <div className="kit-head" data-reveal>
          <div className="section-heading kit-heading">
            <p className="eyebrow">shadcn kit</p>
            <h2 id="kit-title" className="section-title">
              shadcn as a package,
              <br className="kit-wide" /> not a folder to edit
            </h2>
            <p className="section-body kit-lede">
              Editing a shared component can affect every screen that uses it. Buildkit packages the shadcn Base UI
              components as a versioned dependency. Customize them with CSS variables and update the package through
              npm.
            </p>
          </div>
          <pre className="kit-install kit-wide">
            <code>
              <span className="kit-install-line">
                <span className="kit-prompt">$ </span>
                pnpm add @buildkitgg/shadcn-baseui-kit@npm:@buildkitgg/shadcn-baseui-
                <StyleToken style="vega" />
              </span>
              <span className="kit-install-line">
                <span className="tok-kw">import</span>
                <span className="tok-punc">{" { Button } "}</span>
                <span className="tok-kw">from</span>
                <span className="tok-str"> &quot;@buildkitgg/shadcn-baseui-kit&quot;</span>
              </span>
            </code>
          </pre>
        </div>

        <div className="kit-compare" data-reveal-stagger>
          <CopiedPanel />
          <InstalledPanel />
        </div>

        <div className="kit-styles">
          <div className="kit-styles-head" data-reveal>
            <h3 className="kit-styles-title">Pick one of eight upstream styles</h3>
            <p className="kit-styles-note kit-wide">
              Swap the alias in package.json. Imports and managers stay the same.
            </p>
          </div>
          <ul className="kit-style-grid" aria-label="shadcn styles" data-reveal-stagger>
            {STYLES.map((style) => (
              <li key={style} className={`kit-style kit-style-${style}`}>
                <span className="kit-style-top">
                  <span className="kit-style-name">
                    <span className="kit-style-title">{title(style)}</span>
                    <span className="kit-style-package">shadcn-baseui-{style}</span>
                  </span>
                </span>
                <Specimen />
              </li>
            ))}
          </ul>
          <pre className="kit-package kit-narrow">
            <code>
              <span className="kit-package-hint">package.json</span>
              <span className="kit-package-line">&quot;@buildkitgg/shadcn-baseui-kit&quot;:</span>
              <span className="kit-package-line">
                {'  "npm:@buildkitgg/shadcn-baseui-'}
                <StyleToken style="vega" />
                &quot;
              </span>
            </code>
          </pre>
        </div>

        <div className="kit-foot kit-wide" data-reveal>
          <ul className="kit-facts">
            <li>
              <Layers aria-hidden="true" />
              Full Base UI component catalog
            </li>
            <li>
              <Paintbrush aria-hidden="true" />
              Compiled CSS, with or without a reset
            </li>
            <li>
              <Braces aria-hidden="true" />
              tokens.json for light and dark
            </li>
          </ul>
          <Link className="text-link" href={packageGuide("shadcn-baseui-vega")}>
            Installation and style selection
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
