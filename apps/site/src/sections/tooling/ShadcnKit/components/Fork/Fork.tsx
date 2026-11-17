import { BadgeCheck, Boxes, Copy, Hammer, Link2, SquareTerminal, TriangleAlert } from "lucide-react"
import { CopiedPanel } from "./components/CopiedPanel"
import { InstalledPanel } from "./components/InstalledPanel"
import { Path, type Stage } from "./components/Path"

/** Both paths start the same way: the shadcn CLI writes stock `button.tsx`. They part at what happens to it next. */
const SHADCN_STAGES: Stage[] = [
  { icon: SquareTerminal, name: "shadcn CLI", detail: "button.tsx", shared: true },
  { icon: Copy, name: "Copy", detail: "src/components/ui" }
]

const SYNC_STAGES: Stage[] = [
  { icon: SquareTerminal, name: "shadcn CLI", detail: "button.tsx", shared: true },
  { icon: Hammer, name: "Compile", detail: ".js .d.ts .css" },
  { icon: Link2, name: "Link", detail: "@buildkitgg/shadcn" }
]

/** The same stock source, taken two ways: copied into the app by shadcn, or built into a package by shadcn-sync */
export function Fork() {
  return (
    <div className="kit-fork">
      <div className="kit-source">
        <span className="kit-source-icon">
          <Boxes aria-hidden="true" />
        </span>
        <span className="kit-source-titles">
          <span className="kit-source-title">shadcn registry</span>
          <code className="kit-source-file">registry/base-vega/ui/button.tsx</code>
        </span>
      </div>
      <span className="kit-fork-stem" aria-hidden="true" />
      <div className="kit-fork-paths">
        <Path
          tone="copy"
          verdict={
            <>
              <TriangleAlert aria-hidden="true" />
              shadcn on its own
            </>
          }
          command="pnpm dlx shadcn@latest add button"
          label="What shadcn add does"
          stages={SHADCN_STAGES}
        >
          <CopiedPanel />
        </Path>
        <Path
          tone="sync"
          verdict={
            <>
              <BadgeCheck aria-hidden="true" />
              Recommended
            </>
          }
          command="pnpm dlx @buildkitgg/shadcn-sync"
          label="What shadcn-sync does"
          stages={SYNC_STAGES}
        >
          <InstalledPanel />
        </Path>
      </div>
    </div>
  )
}
