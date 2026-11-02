import {
  AppWindow,
  ArrowUpRight,
  BookOpen,
  Bot,
  FlaskConical,
  GitBranch,
  GlobeLock,
  KeyRound,
  Lock,
  ShieldCheck,
  Shuffle,
  User,
  Webhook
} from "lucide-react"
import type { ReactNode } from "react"
import { GithubIcon } from "../../components/GithubIcon"
import { Link } from "../../components/Link"
import { links, packageGuide } from "../../links"
import { Command, SubsectionBar } from "./parts"

const KINDS = ["app", "stories", "e2e"] as const

const WORKTREES = [
  {
    folder: "primary checkout",
    who: "You, in the main folder",
    agent: false,
    wideOnly: false,
    hosts: ["shop.localhost", "shop-stories.localhost", "shop-app-e2e.localhost"]
  },
  {
    folder: "fix-login",
    who: "An agent, in its own worktree",
    agent: true,
    wideOnly: false,
    hosts: ["shop-fix-login.localhost", "shop-fix-login-stories.localhost", "shop-fix-login-app-e2e.localhost"]
  },
  {
    folder: "new-billing",
    who: "An agent, in its own worktree",
    agent: true,
    wideOnly: true,
    hosts: ["shop-new-billing.localhost", "shop-new-billing-stories.localhost", "shop-new-billing-app-e2e.localhost"]
  }
]

const USES: { icon: typeof KeyRound; title: string; desc: string; code: ReactNode }[] = [
  {
    icon: KeyRound,
    title: "Auth callbacks that stay put",
    desc: "Register each worktree's redirect once. The CLI prints the full callback URL for every endpoint.",
    code: (
      <>
        <span className="tok-punc">auth: [</span>
        <span className="tok-str">
          &quot;/api/auth/callback<span className="tl-wide">/github</span>&quot;
        </span>
        <span className="tok-punc">]</span>
      </>
    )
  },
  {
    icon: Webhook,
    title: "Webhooks without a deploy",
    desc: "Tunnel only the POST routes a provider calls. The rest of the app stays local.",
    code: (
      <>
        <span className="tok-punc">paths: [</span>
        <span className="tok-str">&quot;/api/webhooks/payments&quot;</span>
        <span className="tok-punc">]</span>
      </>
    )
  },
  {
    icon: ShieldCheck,
    title: "CSP and cookies like production",
    desc: "A real HTTPS origin, so Content Security Policy and Secure cookies behave as they will when shipped.",
    code: (
      <>
        <span className="tok-kw">connect-src </span>
        <span className="tok-str">https://shop.localhost</span>
      </>
    )
  },
  {
    icon: FlaskConical,
    title: "A server just for E2E",
    desc: "Playwright starts its own endpoint and gets the right base URL from one helper.",
    code: (
      <>
        <span className="tok-kw">await </span>
        <span className="tok-fn">playwrightServer</span>
        <span className="tok-punc">(&quot;app-e2e&quot;)</span>
      </>
    )
  }
]

export function DevDomains() {
  return (
    <section id="dev-domains" className="tl-sub tl-dev" aria-labelledby="dev-domains-title">
      <SubsectionBar
        icon={GlobeLock}
        name="Dev domains"
        pkg="@buildkitgg/dev-domains"
        guide={packageGuide("dev-domains")}
        guideLabel="Dev domains guide"
      />

      <div className="tl-dev-head" data-reveal>
        <div className="tl-dev-copy">
          <h3 id="dev-domains-title" className="tl-heading">
            A real HTTPS domain for
            <br className="tl-wide" /> every server in every worktree
          </h3>
          <p className="tl-body">
            <Link className="package-link" href={packageGuide("dev-domains")}>
              dev-domains
            </Link>{" "}
            gives your app, Storybook and E2E servers stable .localhost names with trusted certificates, tied to the
            worktree they run in. Several agents can work in several worktrees at once without fighting over ports.
          </p>
        </div>
        <div className="tl-run">
          <Command command="npx @buildkitgg/dev-domains run" />
          <Link className="tl-portless" href={links.portless}>
            <GithubIcon />
            <span>Built on Portless</span>
            <ArrowUpRight className="tl-portless-ext" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="tl-part">
        <h4 className="tl-part-title" data-reveal>
          How it works
        </h4>
        <div className="tl-domains" data-reveal>
          <div className="tl-domains-head" aria-hidden="true">
            <span className="tl-col tl-col-worktree">
              <GitBranch />
              worktree
            </span>
            <span className="tl-col-hosts">
              <span className="tl-col">
                <AppWindow />
                app
              </span>
              <span className="tl-col">
                <BookOpen />
                storybook
              </span>
              <span className="tl-col">
                <FlaskConical />
                e2e
              </span>
            </span>
          </div>
          <ul className="tl-worktrees" aria-label="Domains per worktree">
            {WORKTREES.map((worktree) => (
              <li
                key={worktree.folder}
                className={[
                  "tl-worktree",
                  worktree.agent ? "is-agent" : "is-you",
                  worktree.wideOnly ? "tl-wide" : ""
                ].join(" ")}
              >
                <div className="tl-worktree-who">
                  <span className="tl-avatar">
                    {worktree.agent ? <Bot aria-hidden="true" /> : <User aria-hidden="true" />}
                  </span>
                  <span className="tl-worktree-text">
                    <span className="tl-folder">{worktree.folder}</span>
                    <span className="tl-who">{worktree.who}</span>
                  </span>
                </div>
                <ul className="tl-hosts">
                  {worktree.hosts.map((host, index) => (
                    <li key={host} className="tl-host">
                      <Lock aria-hidden="true" />
                      <span className="tl-host-name">{host}</span>
                      <span className="tl-host-kind">{KINDS[index]}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="tl-domains-note">
            <Shuffle aria-hidden="true" />
            <span>The domain stays the same even when the port changes.</span>
          </p>
        </div>
      </div>

      <div className="tl-part">
        <h4 className="tl-part-title" data-reveal>
          What a real domain fixes
        </h4>
        <ul className="tl-uses" data-reveal-stagger>
          {USES.map((use) => {
            const Icon = use.icon
            return (
              <li key={use.title} className="tl-use">
                <h5 className="tl-use-title">
                  <Icon aria-hidden="true" />
                  {use.title}
                </h5>
                <p className="tl-use-desc tl-wide">{use.desc}</p>
                <code className="tl-use-code">{use.code}</code>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
