import {
  BadgeCheck,
  Bot,
  Boxes,
  Copy,
  FileCode,
  FolderPen,
  Hammer,
  Link2,
  Lock,
  PackageCheck,
  Palette,
  ShieldCheck,
  SquareTerminal,
  TriangleAlert,
  type LucideIcon
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { packageGuide } from "../../links"
import "../shadcn-kit.css"
import { GuideLink } from "./parts"

/** shadcn-sync's options, each with the values its CLI takes */
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

type Stage = { icon: LucideIcon; name: string; detail: string; shared?: boolean }

/** Both paths start the same way: the shadcn CLI writes stock `button.tsx`. They part at what happens to it next. */
const SHADCN_STAGES: Stage[] = [
  { icon: SquareTerminal, name: "shadcn CLI", detail: "button.tsx", shared: true },
  { icon: Copy, name: "Copy", detail: "src/components/ui" }
]

const SYNC_STAGES: Stage[] = [
  { icon: SquareTerminal, name: "shadcn CLI", detail: "button.tsx", shared: true },
  { icon: Hammer, name: "Compile", detail: ".js .d.ts .css" },
  { icon: Link2, name: "Link", detail: "@buildkitgg/shadcn" }
]

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
          <span className="kit-panel-sub kit-wide">The same component, compiled from a snapshot you commit</span>
        </span>
        <span className="kit-panel-tag kit-wide">
          <Lock aria-hidden="true" />
          generated
        </span>
      </header>
      <ul className="kit-panel-body kit-files">
        <li className="kit-file is-sealed">
          <Lock aria-hidden="true" />
          <span className="kit-file-path">@buildkitgg/shadcn/ui/button.js</span>
          <span className="kit-file-note kit-wide">compiled from button.tsx</span>
        </li>
        <li className="kit-file is-sealed kit-wide">
          <Lock aria-hidden="true" />
          <span className="kit-file-path">@buildkitgg/shadcn/ui/button.d.ts</span>
          <span className="kit-file-note">its types</span>
        </li>
        <li className="kit-file kit-wide">
          <FileCode aria-hidden="true" />
          <span className="kit-file-path">shadcn-registry.json</span>
          <span className="kit-file-note">the snapshot you commit</span>
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

/**
 * One way to get the component: a verdict, the command, what it does in order, and where the component ends up. The
 * verdict's words, icon and fill, and the wire's line, tell the paths apart without their colors.
 */
function Path({
  tone,
  verdict,
  command,
  label,
  stages,
  children
}: {
  tone: "copy" | "sync"
  verdict: ReactNode
  command: string
  label: string
  stages: Stage[]
  children: ReactNode
}) {
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

/** The same stock source, taken two ways: copied into the app by shadcn, or built into a package by shadcn-sync */
function Fork() {
  return (
    <div className="kit-fork">
      <div className="kit-source">
        <span className="kit-source-icon">
          <Boxes aria-hidden="true" />
        </span>
        <span className="kit-source-titles">
          <span className="kit-source-title">shadcn registry</span>
          <code className="kit-source-file">registry/base-vega/ui/button.tsx</code>
        </span>
      </div>
      <span className="kit-fork-stem" aria-hidden="true" />
      <div className="kit-fork-paths">
        <Path
          tone="copy"
          verdict={
            <>
              <TriangleAlert aria-hidden="true" />
              shadcn on its own
            </>
          }
          command="pnpm dlx shadcn@latest add button"
          label="What shadcn add does"
          stages={SHADCN_STAGES}
        >
          <CopiedPanel />
        </Path>
        <Path
          tone="sync"
          verdict={
            <>
              <BadgeCheck aria-hidden="true" />
              Recommended
            </>
          }
          command="pnpm dlx @buildkitgg/shadcn-sync"
          label="What shadcn-sync does"
          stages={SYNC_STAGES}
        >
          <InstalledPanel />
        </Path>
      </div>
    </div>
  )
}

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
        <span className="kit-install-line tok-com"># builds node_modules/@buildkitgg/shadcn</span>
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

export function ShadcnKit() {
  const [choices, setChoices] = useState(DEFAULTS)
  const choose = (flag: Flag, value: string) => setChoices((current) => ({ ...current, [flag]: value }))

  return (
    <div className="tl-sub">
      <div className="kit-head">
        <h3 className="tl-heading">
          shadcn as a package,
          <br className="kit-wide" /> not a folder to edit
        </h3>
        <p className="tl-body">
          shadcn copies each component into your app as source, so an edit to one changes every screen that uses it.
          shadcn-sync runs the same shadcn CLI, then compiles what it writes into a package in node_modules. Customize
          the components with CSS variables and keep the code stock.
        </p>
      </div>

      <Fork />

      <div className="kit-choose">
        <div className="kit-styles-head">
          <h4 className="tl-part-title">Choose what shadcn builds</h4>
          <p className="kit-styles-note">
            Each choice changes one line of the command. Change them later with shadcn-sync set, and imports and
            managers stay the same.
          </p>
        </div>
        <InstallCommand choices={choices} />
        <OptionPicker choices={choices} onChoose={choose} />
        <p className="kit-styles-note kit-fluent">
          Building on Fluent UI instead? The theme and the modals and alerts managers come as Fluent UI adapters with
          the same API, and the fluent icons bring Fluent&apos;s icons to shadcn.
        </p>
      </div>

      <GuideLink href={packageGuide("shadcn-sync")} label="shadcn-sync guide" />
    </div>
  )
}
