import { ArrowRight, Check, FileCode, Lock, Monitor, Moon, Palette, Sun } from "lucide-react"
import { useId, useRef, useState } from "react"
import { Code } from "../components/Code"
import { HeroField } from "../components/HeroField"
import { Link } from "../components/Link"
import "./hero.css"
import { links, packageGuide } from "../links"

// Hidden until the CLI is ready to recommend. Restore with the Copy icon's import and its use below.
// const INSTALL = "npx @buildkitgg/cli create app my-app"

const THEME_SOURCE = [
  'import { createThemeStore, useTheme, type Theme } from "@buildkitgg/react-theme"',
  'import { createModalManager } from "@buildkitgg/shadcn-modals-manager"',
  'import { ThemePicker } from "./ThemePicker"',
  "",
  "const themeStore = createThemeStore()",
  "const modals = createModalManager()",
  "",
  "const themeModal = modals.createModal<{ theme: Theme }>({",
  '  title: "Choose a theme",',
  "  body: { component: ThemePicker },",
  '  initialState: { theme: "system" },',
  "  defaultResult: null // Cancel resolves to null",
  "})",
  "",
  "export function Appearance() {",
  "  const { theme, setTheme } = useTheme(themeStore)",
  "  async function change() {",
  "    const picked = await themeModal.open({ theme })",
  "    if (picked) {",
  "      setTheme(picked.theme)",
  "    }",
  "  }",
  "  return <button onClick={change}>Change</button>",
  "}"
]

type ThemeChoice = "light" | "dark" | "system"

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor }
]

function Swatch({ value }: { value: ThemeChoice }) {
  const mini = (tone: "light" | "dark") => (
    <span className={`mini mini-${tone}`}>
      <span className="mini-bar" />
      <span className="mini-card">
        <span className="mini-accent" />
        <span className="mini-line" />
      </span>
    </span>
  )

  return (
    <span className="swatch">
      {value === "system" ? (
        <>
          {mini("light")}
          {mini("dark")}
        </>
      ) : (
        mini(value)
      )}
    </span>
  )
}

/*
function CopyCommand({ command, prompt }: { command: string; prompt: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="command">
      {prompt && (
        <span className="command-prompt" aria-hidden="true">
          $
        </span>
      )}
      <code className="command-text">{command}</code>
      <button
        type="button"
        className="command-copy"
        aria-label={copied ? "Copied" : "Copy command"}
        onClick={() => {
          navigator.clipboard
            .writeText(command)
            .then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            })
            .catch(() => setCopied(false))
        }}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
    </div>
  )
}
*/

function ThemeDemo() {
  const group = useId()
  const [open, setOpen] = useState(true)
  const [choice, setChoice] = useState<ThemeChoice>("dark")
  const [applied, setApplied] = useState<ThemeChoice>("system")
  const appliedLabel = OPTIONS.find((option) => option.value === applied)?.label

  return (
    <div className="preview" data-theme={applied === "light" ? "light" : "dark"}>
      <div className="preview-chrome">
        <div className="preview-address">
          <Lock aria-hidden="true" />
          <span>my-app.localhost/settings</span>
        </div>
      </div>
      <div className="preview-viewport">
        <p className="preview-title">Settings</p>
        <div className="setting-row">
          <span className="setting-icon">
            <Palette aria-hidden="true" />
          </span>
          <span className="setting-text">
            <span className="setting-label">Appearance</span>
            <span className="setting-value">{appliedLabel}</span>
          </span>
          <button
            type="button"
            className="setting-change"
            onClick={() => {
              setChoice(applied)
              setOpen(true)
            }}
          >
            Change
          </button>
        </div>
        <div className="modal-layer" hidden={!open}>
          <dialog open className="theme-dialog" aria-labelledby="theme-dialog-title">
            <div className="dialog-head">
              <p id="theme-dialog-title" className="dialog-title">
                Choose a theme
              </p>
              <p className="dialog-body">Applies on this device</p>
            </div>
            <div className="theme-options" role="radiogroup" aria-labelledby="theme-dialog-title">
              {OPTIONS.map((option) => {
                const Icon = option.icon
                const selected = option.value === choice

                return (
                  <label key={option.value} className={selected ? "theme-option is-selected" : "theme-option"}>
                    <input
                      type="radio"
                      className="sr-only"
                      name={group}
                      value={option.value}
                      checked={selected}
                      onChange={() => setChoice(option.value)}
                    />
                    <Swatch value={option.value} />
                    <span className="option-label">
                      <Icon aria-hidden="true" />
                      <span>{option.label}</span>
                      {selected && (
                        <span className="option-check">
                          <Check aria-hidden="true" />
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="dialog-actions">
              <button type="button" className="dialog-cancel" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="dialog-apply"
                onClick={() => {
                  setApplied(choice)
                  setOpen(false)
                }}
              >
                Apply theme
              </button>
            </div>
          </dialog>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  const workbenchRef = useRef<HTMLDivElement>(null)

  return (
    <section className="hero" aria-labelledby="hero-title">
      <HeroField target={workbenchRef} />
      <div className="container hero-inner">
        <Link className="announce" href={packageGuide("scaffolder")} data-intro>
          <span className="announce-badge">NEW</span>
          <span className="announce-text">
            Ship your stack as a template<span className="announce-long"> with @buildkitgg/scaffolder</span>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>
        <div className="hero-row">
          <h1 id="hero-title" className="hero-title">
            <span className="hero-line">
              <span className="hero-line-text" data-intro>
                The batteries
              </span>
            </span>{" "}
            <span className="hero-line">
              <span className="hero-line-text hero-charged" data-intro>
                your frontend
              </span>
            </span>{" "}
            <span className="hero-line hero-last">
              <span className="hero-line-text" data-intro>
                <span className="hero-charged">is missing</span>
                <span className="battery" aria-hidden="true">
                  <span className="battery-cell">
                    <span className="charge" />
                    <span className="charge" />
                    <span className="charge" />
                    <span className="charge is-empty" />
                  </span>
                  <span className="battery-terminal" />
                </span>
              </span>
            </span>
          </h1>
          <div className="hero-copy" data-intro-stagger>
            <p className="hero-lede">
              Reusable application behavior in plain TypeScript, independent of your framework and component library.
              Connect it to your app with existing bindings and adapters, or build your own integration on the same
              core.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href={links.docs}>
                Read the docs
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link className="btn btn-secondary hero-secondary" href={links.packages}>
                Browse packages
              </Link>
            </div>
            {/* <CopyCommand command={INSTALL} prompt /> */}
            <ul className="hero-facts">
              <li>
                <Check aria-hidden="true" />
                MIT licensed
              </li>
              <li>
                <Check aria-hidden="true" />
                Fully typed
              </li>
            </ul>
          </div>
        </div>
        <div className="workbench" ref={workbenchRef} data-intro>
          <div className="workbench-bar">
            <span className="window-controls" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="workbench-tab">
              <FileCode aria-hidden="true" />
              Appearance.tsx
            </span>
          </div>
          <div className="workbench-body">
            <div className="workbench-editor">
              <Code lines={THEME_SOURCE} numbered highlight={18} label="Appearance.tsx" />
            </div>
            <ThemeDemo />
          </div>
        </div>
      </div>
    </section>
  )
}
