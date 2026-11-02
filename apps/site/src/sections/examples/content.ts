import type { ExampleId, WirePart } from "../../frame/bridge"

// The editor shows the same files the frame runs
const SOURCES = import.meta.glob<string>("../../examples/*/*", { query: "?raw", import: "default", eager: true })

function source(path: string) {
  const text = SOURCES[`../../examples/${path}`]
  if (text === undefined) {
    throw new Error(`No example file at ${path}`)
  }
  return text
}

export type ExampleFile = { name: string; source: string; highlight?: readonly number[] }

/** The package each layer of an example comes from, with the role it plays. */
export type Layer = { role: string; name: string }

/**
 * What the preview bar offers beside its hint: Reload, an Online and Offline switch, a `refresh()` call, or a browser's
 * Back, Forward, Reload and address.
 */
export type Control = "reload" | "network" | "refresh" | "browser"

export type Example = {
  id: ExampleId
  chip: string
  layers: Layer[]
  title: string
  description: string
  hint: string
  control?: Control
  files: ExampleFile[]
  /** The file shown first */
  active: string
  /** What the wire shows before the frame reports, and without JavaScript */
  wire: WirePart[]
}

/** The lines from the first to the last, inclusive. */
function lines(first: number, last: number) {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}

export const EXAMPLES: Example[] = [
  {
    id: "modals",
    chip: "Modal results",
    layers: [
      { role: "Core", name: "modal-core" },
      { role: "React", name: "react-modals" },
      { role: "shadcn", name: "shadcn-modals-manager" }
    ],
    title: "Await a decision",
    description:
      "Open a modal and await its typed result. Ask before discarding unsaved changes, then act on the answer.",
    hint: "Edit the name, then press Cancel",
    files: [{ name: "ProjectNameForm.tsx", source: source("modals/ProjectNameForm.tsx"), highlight: lines(12, 22) }],
    active: "ProjectNameForm.tsx",
    wire: [{ label: "modals.confirm()", value: "not called yet", tone: "muted" }]
  },
  {
    id: "preferences",
    chip: "Stored preferences",
    layers: [
      { role: "Core", name: "preferences-core" },
      { role: "React", name: "react-preferences" }
    ],
    title: "Remember every choice",
    description: "Typed defaults and overrides, saved to storage and synced across tabs and sessions.",
    hint: "Pick a size, then reload",
    control: "reload",
    files: [{ name: "TextSizePicker.tsx", source: source("preferences/TextSizePicker.tsx"), highlight: [20, 28] }],
    active: "TextSizePicker.tsx",
    wire: [{ label: "localStorage.preferences", value: "null", tone: "keyword" }]
  },
  {
    id: "alerts",
    chip: "Inline alerts",
    layers: [
      { role: "Core", name: "alert-core" },
      { role: "React", name: "react-alerts" },
      { role: "shadcn", name: "shadcn-alerts-manager" }
    ],
    title: "A queue for every region",
    description:
      "Send each alert to the region it belongs in. A failed save shows beside the form, and saving again replaces it instead of stacking another.",
    hint: "Go offline, then save",
    control: "network",
    files: [
      { name: "ProjectSettings.tsx", source: source("alerts/ProjectSettings.tsx"), highlight: lines(19, 22) },
      { name: "alerts.ts", source: source("alerts/alerts.ts") },
      { name: "api.ts", source: source("alerts/api.ts") }
    ],
    active: "ProjectSettings.tsx",
    wire: [{ label: 'alerts.getSnapshot("settings")', value: "[]", tone: "plain" }]
  },
  {
    id: "routing",
    chip: "Route panels",
    layers: [
      { role: "Core", name: "router-core" },
      { role: "React", name: "react-routing" },
      { role: "React Router", name: "react-router" }
    ],
    title: "Tabs and panels that live in the URL",
    description:
      "Keep route tabs and panels in sync with back, forward, refresh, and deep links. Closing a panel returns to where it opened.",
    hint: "Switch tabs, open a person, then go back",
    control: "browser",
    files: [
      { name: "router.ts", source: source("routing/router.ts") },
      { name: "Workspace.tsx", source: source("routing/Workspace.tsx") },
      { name: "People.tsx", source: source("routing/People.tsx") },
      { name: "PersonPanel.tsx", source: source("routing/PersonPanel.tsx"), highlight: lines(15, 19) },
      { name: "Settings.tsx", source: source("routing/Settings.tsx") }
    ],
    active: "PersonPanel.tsx",
    wire: [
      { label: "tabs.activeTab", value: '"people"', tone: "string" },
      { label: "panel.isOpen", value: "false", tone: "keyword" }
    ]
  },
  {
    id: "configuration",
    chip: "Config overrides",
    layers: [
      { role: "Core", name: "configuration-core" },
      { role: "React", name: "react-configuration" }
    ],
    title: "Settings with safe defaults",
    description:
      "Load settings from your service, typed from their defaults. Override any of them locally while you build.",
    hint: "Pick a value to override it",
    control: "refresh",
    files: [
      { name: "config.ts", source: source("configuration/config.ts"), highlight: [...lines(6, 11), ...lines(24, 28)] },
      { name: "SettingsPanel.tsx", source: source("configuration/SettingsPanel.tsx") },
      { name: "InvoiceList.tsx", source: source("configuration/InvoiceList.tsx") }
    ],
    active: "config.ts",
    wire: [{ label: 'useSetting("language")', value: '{ value: "en", source: "default" }', tone: "plain" }]
  }
]
