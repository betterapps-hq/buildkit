import { Bot, FileCode, FolderPen, Lock, PackageCheck, Palette, ShieldCheck, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { packageGuide } from "../../links"
import "../shadcn-kit.css"
import { GuideLink } from "./parts"

/** shadcn-sync's options, each with the values its CLI takes; the first is the default this section starts on */
const OPTIONS = [
  {
    flag: "base",
    label: "Primitives",
    values: [
      { id: "base", label: "Base UI" },
      { id: "radix", label: "Radix" },
      { id: "aria", label: "React Aria" }
    ]
  },
  {
    flag: "style",
    label: "Style",
    values: ["vega", "nova", "maia", "lyra", "mira", "luma", "rhea", "sera"].map((id) => ({ id, label: id }))
  },
  {
    flag: "theme",
    label: "Theme",
    values: ["neutral", "stone", "zinc", "gray", "mauve", "olive", "mist", "taupe"].map((id) => ({ id, label: id }))
  },
  {
    flag: "icons",
    label: "Icons",
    values: [
      ...["lucide", "tabler", "hugeicons", "phosphor", "remixicon"].map((id) => ({ id, label: id })),
      { id: "@buildkitgg/shadcn-icons-fluent", label: "fluent" }
    ]
  }
] as const

type Flag = (typeof OPTIONS)[number]["flag"]

type Choices = Record<Flag, string>

/** The site's own settings, which its postinstall passes to shadcn-sync */
const DEFAULTS: Choices = { base: "base", style: "vega", theme: "neutral", icons: "lucide" }

function InstallCommand({ choices }: { choices: Choices }) {
  return (
    <pre className="kit-install">
      <code>
        <span className="kit-install-line">
          <span className="kit-prompt">$ </span>
          pnpm dlx @buildkitgg/shadcn-sync{" \\"}
          {OPTIONS.map((option, index) => (
            <span key={option.flag} className="kit-install-flag">
              --{option.flag} <span className="kit-token">{choices[option.flag]}</span>
              {index < OPTIONS.length - 1 ? " \\" : ""}
            </span>
          ))}
        </span>
        <span className="kit-install-line">
          <span className="tok-kw">import</span>
          <span className="tok-punc">{" { Button } "}</span>
          <span className="tok-kw">from</span>
          <span className="tok-str"> &quot;@buildkitgg/shadcn&quot;</span>
        </span>
      </code>
    </pre>
  )
}

function OptionPicker({ choices, onChoose }: { choices: Choices; onChoose: (flag: Flag, value: string) => void }) {
  return (
    <div className="kit-options">
      {OPTIONS.map((option) => (
        <fieldset key={option.flag} className="kit-option">
          <legend className="kit-option-label">
            {option.label}
            <code>--{option.flag}</code>
          </legend>
          <span className="kit-style-list">
            {option.values.map((value) => (
              <label key={value.id} className={choices[option.flag] === value.id ? "is-shown" : undefined}>
                <input
                  type="radio"
                  name={`shadcn-sync-${option.flag}`}
                  value={value.id}
                  checked={choices[option.flag] === value.id}
                  onChange={() => onChoose(option.flag, value.id)}
                />
                {value.label}
              </label>
            ))}
          </span>
        </fieldset>
      ))}
    </div>
  )
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
  const [choices, setChoices] = useState(DEFAULTS)
  const choose = (flag: Flag, value: string) => setChoices((current) => ({ ...current, [flag]: value }))

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
        <InstallCommand choices={choices} />
      </div>

      <div className="kit-styles">
        <div className="kit-styles-head">
          <h4 className="tl-part-title">Choose what shadcn builds</h4>
          <p className="kit-styles-note">
            Pick an option to see its command. Change any of them later with shadcn-sync set, and imports and managers
            stay the same.
          </p>
        </div>
        <OptionPicker choices={choices} onChoose={choose} />
        <p className="kit-styles-note kit-fluent">
          Building on Fluent UI instead? The theme and the modals and alerts managers come as Fluent UI adapters with
          the same API, and the fluent icons bring Fluent&apos;s icons to shadcn.
        </p>
      </div>

      <div className="kit-compare">
        <CopiedPanel />
        <InstalledPanel />
      </div>

      <GuideLink href={packageGuide("shadcn-sync")} label="shadcn-sync guide" />
    </div>
  )
}
