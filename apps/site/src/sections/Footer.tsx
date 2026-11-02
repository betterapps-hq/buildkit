import { Link } from "../components/Link"
import { Logo } from "../components/Logo"
import "./footer.css"
import { links, packageGuide } from "../links"

type FooterLink = {
  label: string
  href: string
  /** A small chip after the label, such as "core". */
  note?: string
  /** Wide screens only; the phone footer keeps the shorter list. */
  wide?: boolean
}

type FooterGroup = { title: string; links: FooterLink[] }

/** Groups in phone order; on wide screens the third column stacks Frameworks over Components. */
const COLUMNS: FooterGroup[][] = [
  [
    {
      title: "Docs",
      links: [
        { label: "Package guides", href: links.packages },
        { label: "API reference", href: links.reference },
        { label: "Storybook", href: links.storybook },
        { label: "Architecture", href: "#architecture", wide: true }
      ]
    }
  ],
  [
    {
      title: "Features",
      links: [
        { label: "Theme switching", href: packageGuide("theme-core") },
        { label: "Stored preferences", href: packageGuide("preferences-core") },
        { label: "Modal results", href: packageGuide("modal-core") },
        { label: "Inline alerts", href: packageGuide("alert-core"), wide: true },
        { label: "Route tabs and panels", href: links.routing },
        { label: "Typed configuration", href: packageGuide("configuration-core"), wide: true }
      ]
    }
  ],
  [
    {
      title: "Frameworks",
      links: [
        { label: "Vanilla", href: `${links.packages}#core`, note: "core" },
        { label: "React", href: `${links.packages}#react` }
      ]
    },
    {
      title: "Components",
      links: [
        { label: "shadcn", href: "#shadcn" },
        { label: "Fluent UI", href: `${links.packages}#fluent-ui` }
      ]
    }
  ],
  [
    {
      title: "Tools",
      links: [
        { label: "CLI", href: packageGuide("cli") },
        { label: "Scaffolder", href: "#scaffolder" },
        { label: "Dev domains", href: "#dev-domains" }
      ]
    }
  ],
  [
    {
      title: "Project",
      links: [
        { label: "GitHub", href: links.github },
        { label: "Contributing", href: `${links.github}/blob/main/CONTRIBUTING.md` },
        { label: "Issues", href: `${links.github}/issues`, wide: true },
        { label: "MIT license", href: `${links.github}/blob/main/LICENSE` }
      ]
    }
  ]
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Logo />
            <p className="footer-tagline">
              Reusable packages and tools to make building with AI faster and more consistent.
            </p>
          </div>
          <nav className="footer-columns" aria-label="Footer">
            {COLUMNS.map((column) => (
              <div key={column[0]?.title} className="footer-column">
                {column.map((group) => (
                  <div key={group.title} className="footer-group">
                    <h2 className="footer-heading">{group.title}</h2>
                    <ul className={`footer-links footer-links-${group.title.toLowerCase()}`}>
                      {group.links.map((link) => (
                        <li key={link.label} className={link.wide ? "footer-wide" : undefined}>
                          <Link href={link.href}>{link.label}</Link>
                          {link.note && <span className="footer-note">{link.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <p className="footer-copyright">
          © 2026 <Link href="https://betterapps.io">Better Apps</Link>
        </p>
      </div>
    </footer>
  )
}
