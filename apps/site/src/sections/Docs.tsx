import { ArrowUpRight, BookOpen, Braces, CornerDownLeft, Play, Plug, Search, SquarePlay } from "lucide-react"
import { GithubIcon } from "../components/GithubIcon"
import { Link } from "../components/Link"
import "./docs.css"
import { links } from "../links"

const DOORS = [
  {
    title: "Package guides",
    description: "Install, integrate and configure each package, with its requirements up front.",
    href: links.packages,
    icon: BookOpen
  },
  {
    title: "API reference",
    description: "Every public type and signature, generated from source.",
    href: links.reference,
    icon: Braces
  },
  {
    title: "Storybook",
    description: "Interactive examples with the code behind each behavior.",
    href: links.storybook,
    icon: SquarePlay
  }
]

type Result = {
  title: string
  description: string
  kind: string
  icon: typeof BookOpen
  code?: boolean
  active?: boolean
  /** Shown on wide screens only; phones list one result per group. */
  extra?: boolean
}

const GROUPS: { label: string; results: Result[] }[] = [
  {
    label: "Guides",
    results: [
      {
        title: "Modal manager",
        description: "Typed results, stack lifecycle and dismissal guards",
        kind: "Guide",
        icon: BookOpen,
        active: true
      },
      {
        title: "shadcn modals manager",
        description: "Managed dialogs with a default renderer",
        kind: "Guide",
        icon: BookOpen,
        extra: true
      }
    ]
  },
  {
    label: "API reference",
    results: [
      {
        title: "createModal(options)",
        description: "ModalDefinition<TData, TResult>",
        kind: "API reference",
        icon: Braces,
        code: true
      },
      {
        title: "confirm(options)",
        description: "StandardModalHandle<boolean, ConfirmModalOptions>",
        kind: "API reference",
        icon: Braces,
        code: true,
        extra: true
      }
    ]
  },
  {
    label: "Storybook",
    results: [{ title: "Confirmation", description: "Return a result from any modal", kind: "Storybook", icon: Play }]
  }
]

/** A static search palette. The query, caret and results carry stable class names for a later typing animation. */
function SearchPalette() {
  return (
    <div className="docs-palette" aria-hidden="true" data-reveal>
      <div className="docs-query">
        <Search className="docs-query-icon" />
        <span className="docs-query-text">modal result</span>
        <span className="docs-caret" />
      </div>
      <div className="docs-results">
        {GROUPS.map((group) => (
          <div key={group.label} className="docs-group">
            <p className="docs-group-label">{group.label}</p>
            {group.results.map((result) => {
              const Icon = result.icon
              const classes = ["docs-result"]
              if (result.active) {
                classes.push("is-active")
              }
              if (result.code) {
                classes.push("is-code")
              }
              if (result.extra) {
                classes.push("docs-wide")
              }
              return (
                <div key={result.title} className={classes.join(" ")}>
                  <span className="docs-result-icon">
                    <Icon />
                  </span>
                  <span className="docs-result-text">
                    <span className="docs-result-title">{result.title}</span>
                    <span className="docs-result-desc">{result.description}</span>
                    <span className="docs-result-kind">{result.kind}</span>
                  </span>
                  {result.active && <CornerDownLeft className="docs-result-enter" />}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Docs() {
  return (
    <section id="docs" className="section docs" aria-labelledby="docs-title">
      <div className="container docs-inner">
        <div className="docs-body">
          <div className="docs-head" data-reveal>
            <div className="section-heading docs-heading">
              <p className="eyebrow">Documentation</p>
              <h2 id="docs-title" className="section-title docs-title">
                Package guides,
                <br className="docs-wide" /> API references,
                <br className="docs-wide" /> and examples
              </h2>
            </div>
            <p className="section-body docs-lede">
              Package guides explain installation and integration requirements. The API reference documents public types
              and signatures, generated from the package source.
            </p>
          </div>
          <SearchPalette />
          <ul className="docs-doors" data-reveal-stagger>
            {DOORS.map((door) => {
              const Icon = door.icon
              return (
                <li key={door.title}>
                  <Link className="docs-door" href={door.href}>
                    <div className="docs-door-top">
                      <Icon className="docs-door-icon" aria-hidden="true" />
                      <h3 className="docs-door-title">{door.title}</h3>
                      <ArrowUpRight className="docs-door-arrow" aria-hidden="true" />
                    </div>
                    <p className="docs-door-desc">{door.description}</p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="docs-contribute" data-reveal>
          <span className="docs-contribute-icon">
            <Plug aria-hidden="true" />
          </span>
          <div className="docs-contribute-text">
            <h3 className="docs-contribute-title">Contribute an adapter</h3>
            <p className="docs-contribute-desc">
              New framework bindings, component libraries and router helpers all build on the same vanilla core.
            </p>
          </div>
          <Link className="docs-discuss" href={`${links.github}/discussions`}>
            <GithubIcon />
            Discuss an adapter
          </Link>
        </div>
      </div>
    </section>
  )
}
