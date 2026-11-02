import { FileCode, GitCompare, ListChecks, Package, PenLine, RefreshCw, SquareTerminal, Terminal } from "lucide-react"
import type { ReactNode } from "react"
import { tokenize } from "../../components/Code"
import { packageGuide } from "../../links"
import { GuideLink } from "./parts"

const FEATURES = [
  {
    icon: ListChecks,
    title: "Required and optional",
    desc: "A template lists the add-ons every project gets and the ones people pick. Slots offer one-of choices, like which database, and groups ask about related add-ons together."
  },
  {
    icon: Package,
    title: "Publish templates on npm",
    desc: "Ship a template package on npm. People install it by name with the scaffold command, or through a CLI you build on the engine."
  },
  {
    icon: GitCompare,
    title: "Change it later",
    desc: "Review planned changes before adding, upgrading, or syncing. The engine merges supported changes and asks you to resolve conflicts with your edits."
  }
]

type TemplateLine = {
  code: string
  wideOnly?: boolean
  tone?: "required" | "optional" | "slot"
  note?: string
}

/** A template for a CLI built on the engine. Its catalog asks each slot's `question`, then its `choose` question. Groups ask their own. */
const TEMPLATE: TemplateLine[] = [
  { code: 'import { defineTemplate } from "@buildkitgg/scaffolder"', wideOnly: true },
  { code: "", wideOnly: true },
  { code: "export const app = defineTemplate({" },
  { code: '  id: "app",' },
  { code: '  title: "App",' },
  { code: '  description: "A React app with lint and tests",' },
  { code: '  target: "web",' },
  {
    code: '  required: ["vite-plus", "vitest"],',
    tone: "required",
    note: "always installed"
  },
  { code: "  groups: {" },
  { code: "    telemetry: {" },
  { code: '      question: "Add telemetry?",', tone: "optional", note: "asked first" },
  { code: '      choose: "Which ones?",' },
  { code: '      pick: "many",', tone: "optional", note: 'checkboxes, "one" for radios' },
  { code: "      addons: {" },
  { code: "        sentry: { default: false },", tone: "optional", note: "then at least one" },
  { code: "        posthog: { default: false },", tone: "optional", note: "then at least one" },
  { code: "      }," },
  { code: "    }," },
  { code: "  }," },
  { code: "  slots: {" },
  {
    code: '    localization: { required: false, default: "lingui" },',
    tone: "slot",
    note: "one of react-intl, lingui"
  },
  { code: "    database: { required: false },", tone: "slot", note: "one of drizzle, prisma, convex" },
  { code: "    auth: { required: false },", tone: "slot", note: "one of better-auth, clerk, workos" },
  { code: "  }," },
  { code: "})" }
]

function Tokens({ line }: { line: string }) {
  if (line === "") {
    return " "
  }
  return tokenize(line).map((token, index) => (
    <span key={index} className={`tok-${token.kind}`}>
      {token.text}
    </span>
  ))
}

function TemplateCode() {
  return (
    <pre className="tl-window-body tl-template-body" aria-label="templates/app.ts">
      <code>
        {TEMPLATE.map((line, index) => (
          <span
            key={index}
            className={["tl-code-line", line.tone ? `is-${line.tone}` : "", line.wideOnly ? "tl-wide" : ""].join(" ")}
          >
            <span className="tl-code-text">
              <Tokens line={line.code} />
            </span>
            {line.note && <span className="tl-code-note">{line.note}</span>}
          </span>
        ))}
      </code>
    </pre>
  )
}

/** The wizard asks each slot, then each group. Answered questions stay above the one being asked. */
const ANSWERS = [
  { question: "Add localization?", answer: "Yes" },
  { question: "Which library?", answer: "Lingui" },
  { question: "Add a database?", answer: "Yes" },
  { question: "Which ORM?", answer: "Drizzle" },
  { question: "Add authentication?", answer: "Yes" },
  { question: "Which provider?", answer: "Better Auth" },
  { question: "Add telemetry?", answer: "Yes" }
]

/** The group's checkboxes, mid-answer. */
const CHECKBOXES = [
  { label: "Sentry", checked: true },
  { label: "PostHog", checked: false }
]

function Bar({ children }: { children?: ReactNode }) {
  return (
    <span className="tl-term-line">
      <span className="tl-t-bar">│</span>
      {children}
    </span>
  )
}

const ANSWER_COLUMN = Math.max(...ANSWERS.map((line) => line.question.length)) + 2

/** An answered question, with its answer on the same line to save space. */
function Answer({ question, answer }: { question: string; answer: string }) {
  return (
    <span className="tl-term-line">
      <span className="tl-glyph tl-t-done">◇</span>
      {"  "}
      {question.padEnd(ANSWER_COLUMN)}
      <span className="tl-t-dim">{answer}</span>
    </span>
  )
}

function Prompt({ children }: { children: ReactNode }) {
  return (
    <span className="tl-term-line">
      <span className="tl-t-prompt">$ </span>
      {children}
    </span>
  )
}

function InstallTerminal() {
  return (
    <pre className="tl-window-body tl-term-body">
      <code>
        <Prompt>npx @acme/cli create app my-app</Prompt>
        <Bar />
        {ANSWERS.map((line) => (
          <Answer key={line.question} {...line} />
        ))}
        <Bar />
        <span className="tl-term-line">
          <span className="tl-glyph tl-t-mark">◆</span>
          {"  "}Which ones?
        </span>
        {CHECKBOXES.map((box) => (
          <Bar key={box.label}>
            {"  "}
            <span className={`tl-glyph ${box.checked ? "tl-t-ok" : "tl-t-dim"}`}>{box.checked ? "◼" : "◻"}</span>{" "}
            <span className={box.checked ? undefined : "tl-t-dim"}>{box.label}</span>
          </Bar>
        ))}
        <span className="tl-term-line tl-t-bar">└</span>
      </code>
    </pre>
  )
}

/** Short names work on the command line. `--replace` names the add-on a slot swap takes out. */
const LATER = [
  { command: "pnpm acme add posthog", result: "+ 3 files  ~ 2 updated" },
  { command: "pnpm acme add prisma --replace drizzle", result: "Drizzle to Prisma" },
  { command: "pnpm acme upgrade", result: "fixes merged, edits kept" }
]

const LATER_COLUMN = Math.max(...LATER.map((line) => line.command.length)) + 2

function LaterTerminal() {
  return (
    <pre className="tl-window-body tl-term-body">
      <code>
        {LATER.map((line) => (
          <Prompt key={line.command}>
            {line.command}
            <span className="tl-t-dim tl-wide">
              {" ".repeat(LATER_COLUMN - line.command.length)}
              {line.result}
            </span>
          </Prompt>
        ))}
      </code>
    </pre>
  )
}

function WindowBar({ icon: Icon, title }: { icon: typeof FileCode; title?: string }) {
  return (
    <div className="tl-window-bar">
      <Icon aria-hidden="true" />
      {title && <span>{title}</span>}
    </div>
  )
}

const STEPS = [
  {
    key: "author",
    icon: PenLine,
    title: "You write the template",
    window: (
      <div className="tl-window tl-template">
        <WindowBar icon={FileCode} title="templates/app.ts" />
        <TemplateCode />
      </div>
    )
  },
  {
    key: "install",
    icon: Terminal,
    title: "Developers create a project",
    window: (
      <div className="tl-window tl-terminal tl-terminal-install">
        <WindowBar icon={SquareTerminal} />
        <InstallTerminal />
      </div>
    )
  },
  {
    key: "evolve",
    icon: RefreshCw,
    title: "They change it later",
    window: (
      <div className="tl-window tl-terminal tl-terminal-later">
        <WindowBar icon={SquareTerminal} />
        <LaterTerminal />
      </div>
    )
  }
]

export function Scaffolder() {
  return (
    <div className="tl-sub">
      <div className="tl-scaf-body">
        <div className="tl-scaf-copy">
          <h3 className="tl-heading">
            Ship your stack
            <br className="tl-wide" /> as a template
          </h3>
          <p className="tl-body">
            Build starter templates and a project-creation wizard for your platform. Define required packages, optional
            add-ons, and setup choices in a catalog. Publish your templates or build your own CLI on the engine.
            Developers can create projects, choose add-ons, and update them later.
          </p>
          <ul className="tl-features tl-wide">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <li key={feature.title} className="tl-feature">
                  <span className="tl-feature-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <div className="tl-feature-text">
                    <h4 className="tl-feature-title">{feature.title}</h4>
                    <p className="tl-feature-desc">{feature.desc}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="tl-flow">
          <h4 className="tl-part-title">How it works</h4>
          <ol className="tl-steps">
            {STEPS.map((step) => {
              const Icon = step.icon
              return (
                <li key={step.key} className={`tl-step tl-step-${step.key}`}>
                  <span className="tl-step-track" aria-hidden="true">
                    <span className="tl-spine tl-spine-above" />
                    <span className="tl-step-node" />
                    <span className="tl-spine tl-spine-below" />
                  </span>
                  <div className="tl-step-content">
                    <h5 className="tl-step-title">
                      <Icon aria-hidden="true" />
                      {step.title}
                    </h5>
                    {step.window}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <GuideLink href={packageGuide("scaffolder")} label="Scaffolder guide" />
    </div>
  )
}
