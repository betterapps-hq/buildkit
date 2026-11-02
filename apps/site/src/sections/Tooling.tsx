import { Blocks, GlobeLock, Palette } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { DevDomains } from "./tooling/DevDomains"
import { Scaffolder } from "./tooling/Scaffolder"
import { ShadcnKit } from "./tooling/ShadcnKit"
import "./tooling.css"

const TOOLS = [
  { id: "dev-domains", icon: GlobeLock, name: "Dev domains", Panel: DevDomains },
  { id: "scaffolder", icon: Blocks, name: "Scaffolder", Panel: Scaffolder },
  { id: "shadcn", icon: Palette, name: "shadcn kit", Panel: ShadcnKit }
]

type ToolId = (typeof TOOLS)[number]["id"]

export function Tooling() {
  const [current, setCurrent] = useState<ToolId>("dev-domains")
  const [stuck, setStuck] = useState(false)
  const marker = useRef<HTMLDivElement>(null)

  // The bar is stuck once the spot it sits in at rest has scrolled up past the top of the screen
  useEffect(() => {
    const element = marker.current
    if (!element) {
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => {
      setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The bar marks the tool crossing the middle of the screen
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCurrent(entry.target.id)
          }
        }
      },
      { rootMargin: "-45% 0px -55% 0px" }
    )
    for (const tool of TOOLS) {
      const element = document.getElementById(tool.id)
      if (element) {
        observer.observe(element)
      }
    }
    return () => observer.disconnect()
  }, [])

  return (
    <section id="tooling" className="section section-ruled tooling" aria-labelledby="tooling-title">
      <div className="container">
        <div className="tl-intro" data-reveal>
          <p className="eyebrow">Developer tooling</p>
          <h2 id="tooling-title" className="section-title tl-title">
            Tooling that keeps pace
            <br className="tl-wide" /> with your agents
          </h2>
          <p className="section-body tl-intro-body">
            The faster your agents work, the more the setup around them gets in the way. Buildkit&apos;s developer tools
            take it out of the path, across every project and every agent you run.
          </p>
        </div>
        <div className="tl-stage">
          <div ref={marker} aria-hidden="true" />
          <nav className="tl-nav" aria-label="Tools" data-stuck={stuck || undefined}>
            <ul className="tl-chips">
              {TOOLS.map((tool) => {
                const Icon = tool.icon
                return (
                  <li key={tool.id}>
                    <a className="tl-chip" href={`#${tool.id}`} aria-current={tool.id === current ? "true" : undefined}>
                      <Icon aria-hidden="true" />
                      {tool.name}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
          {TOOLS.map(({ id, name, Panel }) => (
            <section key={id} id={id} className="tl-tool" aria-labelledby={`${id}-name`}>
              <p id={`${id}-name`} className="eyebrow tl-tool-name">
                {name}
              </p>
              <Panel />
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}
