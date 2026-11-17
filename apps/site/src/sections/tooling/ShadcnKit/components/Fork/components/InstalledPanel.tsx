import { FileCode, Lock, PackageCheck, Palette, ShieldCheck } from "lucide-react"

/** Where shadcn-sync leaves the component: the same file, compiled into a package the app imports */
export function InstalledPanel() {
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
