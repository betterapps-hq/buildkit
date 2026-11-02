import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Bot,
  Braces,
  ChevronsDown,
  FileCheck,
  Lock,
  Route,
  SlidersHorizontal,
  SquareStack,
  SunMoon,
  ToggleRight,
  type LucideIcon
} from "lucide-react"
import { useState, type ComponentType } from "react"
import { FluentMark, ShadcnMark } from "../components/LibraryMarks"
import { Link } from "../components/Link"
import "./architecture.css"
import { links, packageGuide } from "../links"

type Feature = "theme" | "modals" | "alerts" | "routing" | "preferences" | "configuration"

const FEATURE_ICONS: Record<Feature, LucideIcon> = {
  theme: SunMoon,
  modals: SquareStack,
  alerts: BellRing,
  routing: Route,
  preferences: SlidersHorizontal,
  configuration: ToggleRight
}

/** The scroll story traces the modal path up through each layer and names its packages. */
const TRACED: Feature = "modals"

type Pkg = { name: string; feature: Feature }

type DeckPlate = {
  id: string
  label: string
  /** A shorter switch label for phones, where the design has one. */
  shortLabel?: string
  /** The lowercase tag shown on the plate while it sits at the back of the deck. */
  tag: string
  packages: Pkg[]
  /** The library's maker, shown under its packages */
  brand?: { name: string; Mark: ComponentType }
  extra?: { kind: "desc"; text: string }
}

const COMPONENT_LIBRARIES: DeckPlate[] = [
  {
    id: "shadcn",
    label: "shadcn",
    tag: "shadcn",
    packages: [
      { name: "shadcn-theme", feature: "theme" },
      { name: "shadcn-modals-manager", feature: "modals" },
      { name: "shadcn-alerts-manager", feature: "alerts" }
    ],
    brand: { name: "shadcn", Mark: ShadcnMark }
  },
  {
    id: "fluentui",
    label: "Fluent UI",
    tag: "fluent ui",
    packages: [
      { name: "fluentui-theme", feature: "theme" },
      { name: "fluentui-modals-manager", feature: "modals" },
      { name: "fluentui-alerts-manager", feature: "alerts" }
    ],
    brand: { name: "Fluent UI", Mark: FluentMark }
  }
]

const LIBRARY_HELPERS: DeckPlate[] = [
  {
    id: "react-router",
    label: "React Router",
    tag: "react router",
    packages: [{ name: "react-router", feature: "routing" }],
    extra: { kind: "desc", text: "Route tabs and panels for data routers" }
  },
  {
    id: "tanstack-router",
    label: "TanStack Router",
    shortLabel: "TanStack",
    tag: "tanstack router",
    packages: [{ name: "tanstack-router", feature: "routing" }],
    extra: { kind: "desc", text: "Route tabs and panels for TanStack Router" }
  }
]

const REACT_PACKAGES: Pkg[] = [
  { name: "react-theme", feature: "theme" },
  { name: "react-modals", feature: "modals" },
  { name: "react-alerts", feature: "alerts" },
  { name: "react-routing", feature: "routing" },
  { name: "react-preferences", feature: "preferences" },
  { name: "react-configuration", feature: "configuration" }
]

const CORE_PACKAGES: Pkg[] = [
  { name: "theme-core", feature: "theme" },
  { name: "modal-core", feature: "modals" },
  { name: "alert-core", feature: "alerts" },
  { name: "router-core", feature: "routing" },
  { name: "preferences-core", feature: "preferences" },
  { name: "configuration-core", feature: "configuration" }
]

type Level = { id: "libraries" | "framework" | "core"; title: string; note: string }

/** The layers of the stack from the top down, shown on the rails beside the plates and in the scroll story's legend. */
const LEVELS: Level[] = [
  { id: "libraries", title: "Libraries", note: "Pick one per tower. Swap it without touching the layers below." },
  { id: "framework", title: "Framework", note: "Bindings to your framework's lifecycle, with no provider." },
  { id: "core", title: "Vanilla core", note: "Plain TypeScript state and lifecycle. No UI, no framework." }
]

function traced(packages: Pkg[]) {
  return packages.find((pkg) => pkg.feature === TRACED)?.name ?? ""
}

const PROOF: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Braces,
    title: "Typed end to end",
    desc: "Typed inputs and results make the API explicit"
  },
  {
    icon: FileCheck,
    title: "A reviewed public API",
    desc: "Every signature change is reviewed before release"
  },
  {
    icon: Lock,
    title: "Out of your source tree",
    desc: "Installed as dependencies rather than copied into your app's source"
  }
]

function Chips({ packages, label }: { packages: Pkg[]; label: string }) {
  return (
    <ul className="arch-chips" aria-label={label}>
      {packages.map((pkg) => {
        const Icon = FEATURE_ICONS[pkg.feature]
        return (
          <li key={pkg.name}>
            <Link className="arch-chip" href={packageGuide(pkg.name)} data-feature={pkg.feature}>
              <Icon className="arch-chip-icon" aria-hidden="true" />
              <span className="arch-chip-name">{pkg.name}</span>
              <ArrowUpRight className="arch-chip-out" aria-hidden="true" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Rail({ level }: { level: Level }) {
  return (
    <div className="arch-rail">
      <span className="arch-rail-track" aria-hidden="true">
        <span className="arch-rail-line" />
        <span className="arch-rail-node" />
        <span className="arch-rail-line" />
      </span>
      <div className="arch-rail-text">
        <p className="arch-rail-title">{level.title}</p>
        <p className="arch-rail-note">{level.note}</p>
      </div>
    </div>
  )
}

/** One tower of the stack: a switch over a deck of plates, where the chosen plate sits at the front. */
function Tower({ id, title, choice, plates }: { id: string; title: string; choice: string; plates: DeckPlate[] }) {
  const [front, setFront] = useState(plates[0].id)

  return (
    <div className="arch-tower" data-tower={id}>
      <div className="arch-tower-head">
        <h3 className="arch-tower-label">{title}</h3>
        <fieldset className="arch-switch" aria-label={choice}>
          {plates.map((plate) => (
            <button
              key={plate.id}
              type="button"
              className="arch-switch-option"
              aria-pressed={plate.id === front}
              onClick={() => setFront(plate.id)}
            >
              {plate.shortLabel ? (
                <>
                  <span className="arch-wide">{plate.label}</span>
                  <span className="arch-narrow">{plate.shortLabel}</span>
                </>
              ) : (
                plate.label
              )}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="arch-deck" data-front={front}>
        {plates.map((plate) => (
          <div
            key={plate.id}
            className="arch-plate arch-deck-plate"
            data-plate={plate.id}
            data-position={plate.id === front ? "front" : "back"}
          >
            <span className="arch-plate-tag" aria-hidden="true">
              {plate.tag}
            </span>
            <div className="arch-plate-body">
              <Chips packages={plate.packages} label={`${plate.label} packages`} />
              {plate.brand && (
                <p className="arch-plate-brand">
                  <plate.brand.Mark />
                  {plate.brand.name}
                </p>
              )}
              {plate.extra?.kind === "desc" && <p className="arch-plate-desc">{plate.extra.text}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LayerPlate({ id, title, packages }: { id: string; title: string; packages: Pkg[] }) {
  return (
    <div className="arch-plate-wrap">
      <span className="arch-connector" aria-hidden="true">
        <ChevronsDown />
      </span>
      <div className="arch-plate arch-layer-plate" data-plate={id}>
        <h3 className="arch-plate-label">{title}</h3>
        <Chips packages={packages} label={`${title} packages`} />
      </div>
    </div>
  )
}

/** A plate in the scroll story. Its chips take the cell CSS gives their feature, so each sits above the same feature below. */
function StoryPlate({
  id,
  label,
  Mark,
  packages
}: {
  id: string
  label: string
  Mark?: ComponentType
  packages: Pkg[]
}) {
  return (
    <div className="arch-story-plate" data-plate={id}>
      <span className="arch-story-plate-label">
        {Mark && <Mark />}
        {label}
      </span>
      {packages.map((pkg) => {
        const Icon = FEATURE_ICONS[pkg.feature]
        return (
          <span key={pkg.name} className="arch-story-chip" data-feature={pkg.feature}>
            <Icon aria-hidden="true" />
            <span className="arch-story-chip-name">{pkg.name}</span>
          </span>
        )
      })}
    </div>
  )
}

/**
 * The scroll story drawn over the pinned stage: the stack builds from the vanilla core up, light carries each package
 * through the layers into an app, and an agent swaps the component library while everything below stays lit. The
 * motion module drives all of it, and it stays hidden without motion.
 */
function Story() {
  const [shadcn, fluentui] = COMPONENT_LIBRARIES
  return (
    <div className="arch-story" aria-hidden="true">
      <div className="arch-story-scene">
        <div className="arch-story-tilt">
          <div className="arch-story-zoom">
            <div className="arch-story-turn">
              <StoryPlate id="core" label="Vanilla core" packages={CORE_PACKAGES} />
              <StoryPlate id="react" label="React" packages={REACT_PACKAGES} />
              <StoryPlate id="router" label={LIBRARY_HELPERS[0].label} packages={LIBRARY_HELPERS[0].packages} />
              {COMPONENT_LIBRARIES.map((library) => (
                <StoryPlate
                  key={library.id}
                  id={library.id}
                  label={library.label}
                  Mark={library.brand?.Mark}
                  packages={library.packages}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <svg className="arch-story-lines">
        {LEVELS.map((level) => (
          <path key={level.id} className="arch-story-leader" data-level={level.id} />
        ))}
        {LEVELS.map((level) => (
          <path key={level.id} className="arch-story-tie" data-level={level.id} />
        ))}
      </svg>
      <ol className="arch-story-legend">
        {LEVELS.map((level) => (
          <li key={level.id} className="arch-story-level" data-level={level.id}>
            <span className="arch-story-node" />
            {level.id !== "core" && (
              <span className="arch-story-link">
                <span className="arch-story-link-fill" />
              </span>
            )}
            <p className="arch-story-title">{level.title}</p>
            <p className="arch-story-note">{level.note}</p>
          </li>
        ))}
      </ol>
      <div className="arch-story-tags">
        <span className="arch-story-tag" data-level="core">
          {traced(CORE_PACKAGES)}
        </span>
        <span className="arch-story-tag" data-level="framework">
          {traced(REACT_PACKAGES)}
        </span>
        <span className="arch-story-tag" data-level="libraries">
          <span data-kit={shadcn.id}>{traced(shadcn.packages)}</span>
          <span data-kit={fluentui.id}>{traced(fluentui.packages)}</span>
        </span>
      </div>
      <div className="arch-story-app">
        <p className="arch-story-app-bar">
          Your app
          <span className="arch-story-app-kit">
            {COMPONENT_LIBRARIES.map((library) => (
              <span key={library.id} data-kit={library.id}>
                {library.label}
              </span>
            ))}
          </span>
        </p>
        <div className="arch-story-app-view">
          {COMPONENT_LIBRARIES.map((library) => (
            <div key={library.id} className="arch-story-dialog" data-kit={library.id}>
              <p className="arch-story-dialog-title">Unsaved changes</p>
              <p className="arch-story-dialog-text">
                Are you sure you want to leave? Your changes won&apos;t be saved.
              </p>
              <p className="arch-story-dialog-actions">
                <span className="arch-story-button">Stay</span>
                <span className="arch-story-button is-primary">Leave</span>
              </p>
            </div>
          ))}
        </div>
      </div>
      {/* Over the app, so the light can reach into it and land on the dialog */}
      <canvas className="arch-story-light" />
      <div className="arch-story-swap">
        <p className="arch-story-agent">
          <Bot aria-hidden="true" />
          <span className="arch-story-prompt">Switch design systems</span>
        </p>
        <div className="arch-story-diff">
          <p className="arch-story-diff-file">modals.ts</p>
          <p className="arch-story-diff-line" data-change="removed">
            @buildkitgg/{traced(shadcn.packages)}
          </p>
          <p className="arch-story-diff-line" data-change="added">
            @buildkitgg/{traced(fluentui.packages)}
          </p>
        </div>
      </div>
    </div>
  )
}

export function Architecture() {
  return (
    <section id="architecture" className="section architecture" aria-labelledby="architecture-title">
      <div className="container arch-inner">
        <div className="section-head arch-head" data-reveal>
          <div className="section-heading">
            <p className="eyebrow">Architecture</p>
            <h2 id="architecture-title" className="section-title arch-title">
              Behavior at the core,
              <br /> everything else plugs in
            </h2>
          </div>
          <div className="section-intro arch-intro">
            <p>
              Core packages hold each pattern&apos;s state and lifecycle in plain TypeScript. Framework bindings connect
              that behavior to your app, and adapters connect it to your libraries. Build an adapter for another library
              while reusing the underlying behavior.
            </p>
            <Link className="text-link arch-link" href={links.docs}>
              Read about the architecture
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="arch-stage">
          <div className="arch-stack" data-reveal-stagger>
            <div className="arch-level" data-layer="libraries">
              <Rail level={LEVELS[0]} />
              <div className="arch-level-body">
                <div className="arch-towers">
                  <Tower
                    id="components"
                    title="Component libraries"
                    choice="Pick a component library"
                    plates={COMPONENT_LIBRARIES}
                  />
                  <Tower id="helpers" title="Library helpers" choice="Pick a router" plates={LIBRARY_HELPERS} />
                </div>
              </div>
            </div>
            <div className="arch-level" data-layer="framework">
              <Rail level={LEVELS[1]} />
              <div className="arch-level-body">
                <LayerPlate id="react" title="React" packages={REACT_PACKAGES} />
              </div>
            </div>
            <div className="arch-level" data-layer="core">
              <Rail level={LEVELS[2]} />
              <div className="arch-level-body">
                <LayerPlate id="core" title="Vanilla core" packages={CORE_PACKAGES} />
              </div>
            </div>
          </div>
          <Story />
        </div>

        <div className="arch-value" data-reveal>
          <div className="arch-value-text">
            <h3 className="arch-value-title">Less code for your agents to write, and for you to review</h3>
            <p className="arch-value-body">
              Open a modal and await its result while the package manages state and lifecycle. Your agent uses the
              package API to connect that behavior to your app.
            </p>
          </div>
          <ul className="arch-proof">
            {PROOF.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.title} className="arch-proof-item">
                  <Icon className="arch-proof-icon" aria-hidden="true" />
                  <span className="arch-proof-text">
                    <span className="arch-proof-title">{item.title}</span>
                    <span className="arch-proof-desc">{item.desc}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
