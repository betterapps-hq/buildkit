import { ArrowRight } from "lucide-react"
import { useRef } from "react"
import { GithubIcon } from "../components/GithubIcon"
import { HeroField } from "../components/HeroField"
import { Link } from "../components/Link"
import "./closing-cta.css"
import { links } from "../links"

// Hidden until the CLI is ready to recommend. Restore with the Check, Copy and useState imports and its use below.
/*
const INSTALL = "npx @buildkitgg/cli create app my-app"

function InstallCommand() {
  const [copied, setCopied] = useState(false)
  return (
    <div className="command cta-command">
      <span className="command-prompt" aria-hidden="true">
        $
      </span>
      <code className="command-text">{INSTALL}</code>
      <button
        type="button"
        className="command-copy"
        aria-label={copied ? "Copied" : "Copy command"}
        onClick={() => {
          navigator.clipboard
            .writeText(INSTALL)
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

export function ClosingCta() {
  const batteryRef = useRef<HTMLSpanElement>(null)

  return (
    <section id="get-started" className="section section-ruled cta" aria-labelledby="cta-title">
      <HeroField target={batteryRef} intensity={0.5} />
      <div className="container cta-inner">
        <div className="cta-headline" data-reveal>
          <h2 id="cta-title" className="cta-title">
            Batteries included
          </h2>
          <span className="cta-battery" ref={batteryRef} aria-hidden="true">
            <span className="cta-cell">
              <span className="cta-charge" />
              <span className="cta-charge" />
              <span className="cta-charge" />
              <span className="cta-charge" />
            </span>
            <span className="cta-terminal" />
          </span>
        </div>
        <p className="cta-body" data-reveal>
          Add the packages your app needs. Each package is MIT licensed, typed, tested, and documented.
        </p>
        <div className="cta-actions" data-reveal>
          <Link className="btn btn-primary cta-btn" href={links.docs}>
            Read the docs
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link className="btn btn-secondary cta-btn" href={links.github}>
            <GithubIcon />
            Star on GitHub
          </Link>
        </div>
        {/* <div className="cta-install" data-reveal>
          <InstallCommand />
        </div> */}
      </div>
    </section>
  )
}
