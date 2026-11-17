import { useState } from "react"
import { packageGuide } from "../../../links"
import "../../shadcn-kit.css"
import { GuideLink } from "../parts"
import { Fork } from "./components/Fork/Fork"
import { InstallCommand } from "./components/InstallCommand"
import { OptionPicker } from "./components/OptionPicker"
import { DEFAULTS, type Flag } from "./shadcnSyncOptions"

export function ShadcnKit() {
  const [choices, setChoices] = useState(DEFAULTS)
  const choose = (flag: Flag, value: string) => setChoices((current) => ({ ...current, [flag]: value }))

  return (
    <div className="tl-sub">
      <div className="kit-head">
        <h3 className="tl-heading">
          shadcn as a package,
          <br className="kit-wide" /> not a folder to edit
        </h3>
        <p className="tl-body">
          shadcn copies each component into your app as source, so an edit to one changes every screen that uses it.
          shadcn-sync runs the same shadcn CLI, then compiles what it writes into a package in node_modules. Customize
          the components with CSS variables and keep the code stock.
        </p>
      </div>

      <Fork />

      <div className="kit-choose">
        <div className="kit-styles-head">
          <h4 className="tl-part-title">Choose what shadcn builds</h4>
          <p className="kit-styles-note">
            Each choice changes one line of the command. Change them later with shadcn-sync set, and imports and
            managers stay the same.
          </p>
        </div>
        <InstallCommand choices={choices} />
        <OptionPicker choices={choices} onChoose={choose} />
        <p className="kit-styles-note kit-fluent">
          Building on Fluent UI instead? The theme and the modals and alerts managers come as Fluent UI adapters with
          the same API, and the fluent icons bring Fluent&apos;s icons to shadcn.
        </p>
      </div>

      <GuideLink href={packageGuide("shadcn-sync")} label="shadcn-sync guide" />
    </div>
  )
}
