import { ArrowDown, Blocks, GlobeLock } from "lucide-react"
import { DevDomains } from "./tooling/DevDomains"
import { Scaffolder } from "./tooling/Scaffolder"
import "./tooling.css"

const TOOLS = [
  {
    id: "dev-domains",
    icon: GlobeLock,
    name: "Dev domains",
    pkg: "@buildkitgg/dev-domains",
    desc: "Stable HTTPS domains for every server in every worktree"
  },
  {
    id: "scaffolder",
    icon: Blocks,
    name: "Scaffolder",
    pkg: "@buildkitgg/scaffolder",
    desc: "Templates with required and optional add-ons, installed and changed from a CLI"
  }
]

export function Tooling() {
  return (
    <section id="tooling" className="section section-ruled tooling" aria-labelledby="tooling-title">
      <div className="container">
        <div className="tl-intro">
          <div className="tl-intro-heading" data-reveal>
            <p className="eyebrow">Developer tooling</p>
            <h2 id="tooling-title" className="section-title tl-title">
              Tools for the chores
              <br className="tl-wide" /> that keep coming up
            </h2>
            <p className="section-body tl-intro-body">
              Run development servers across worktrees, or build starter templates and project-creation wizards for your
              platform. Use the same commands yourself or through your coding agents.
            </p>
          </div>
          <ul className="tl-index tl-wide" aria-label="Tools in this section" data-reveal-stagger>
            {TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <li key={tool.id}>
                  <a className="tl-tool" href={`#${tool.id}`}>
                    <span className="tl-tool-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="tl-tool-text">
                      <span className="tl-tool-title">
                        <span className="tl-tool-name">{tool.name}</span>
                        <span className="tl-tool-pkg">{tool.pkg}</span>
                      </span>
                      <span className="tl-tool-desc">{tool.desc}</span>
                    </span>
                    <ArrowDown className="tl-tool-jump" aria-hidden="true" />
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
        <DevDomains />
        <Scaffolder />
      </div>
    </section>
  )
}
