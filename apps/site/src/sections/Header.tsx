import { ArrowUpRight, Menu, X } from "lucide-react"
import { useState } from "react"
import { GithubIcon } from "../components/GithubIcon"
import { Link } from "../components/Link"
import { Logo } from "../components/Logo"
import "./header.css"
import { links } from "../links"

const NAV = [
  { label: "Docs", href: links.docs },
  { label: "Packages", href: links.packages },
  { label: "Examples", href: "#examples" },
  { label: "Architecture", href: "#architecture" },
  { label: "Storybook", href: links.storybook }
]

export function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="container nav">
        <div className="nav-left">
          <a href="#main" className="nav-logo" aria-label="buildkit.gg home">
            <Logo />
          </a>
          <nav aria-label="Main">
            <ul className="nav-links">
              {NAV.map((item, index) => (
                <li key={item.label}>
                  <Link href={item.href} className={index === 0 ? "nav-link is-current" : "nav-link"}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="nav-right">
          <Link href={links.github} className="nav-github">
            <GithubIcon />
            GitHub
          </Link>
          <Link href={links.docs} className="nav-cta">
            Get started
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="nav-icon-button nav-mobile-only"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div id="mobile-menu" className="mobile-menu" hidden={!open}>
        <ul>
          {NAV.map((item) => (
            <li key={item.label}>
              <Link href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href={links.github} onClick={() => setOpen(false)}>
              GitHub
            </Link>
          </li>
        </ul>
      </div>
    </header>
  )
}
