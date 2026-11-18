import { OPTIONS, type Choices } from "../shadcnSyncOptions"

type InstallCommandProps = { choices: Choices }

/** The install command for the chosen options, one flag per line, and the import it makes possible */
export function InstallCommand({ choices }: InstallCommandProps) {
  return (
    <pre className="kit-install">
      <code>
        <span className="kit-install-line">
          <span className="kit-prompt">$ </span>
          pnpm dlx @buildkitgg/shadcn-sync{" \\"}
          {OPTIONS.map((option, index) => (
            <span key={option.flag} className="kit-install-flag">
              --{option.flag} <span className="kit-token">{choices[option.flag]}</span>
              {index < OPTIONS.length - 1 ? " \\" : ""}
            </span>
          ))}
        </span>
        <span className="kit-install-line tok-com"># builds node_modules/@buildkitgg/shadcn</span>
        <span className="kit-install-line">
          <span className="tok-kw">import</span>
          <span className="tok-punc">{" { Button } "}</span>
          <span className="tok-kw">from</span>
          <span className="tok-str"> &quot;@buildkitgg/shadcn&quot;</span>
        </span>
      </code>
    </pre>
  )
}
