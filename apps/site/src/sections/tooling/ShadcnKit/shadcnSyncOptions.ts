/** shadcn-sync's options, each with the values its CLI takes */
export const OPTIONS = [
  {
    flag: "base",
    label: "Primitives",
    values: [
      { id: "base", label: "Base UI" },
      { id: "radix", label: "Radix" },
      { id: "aria", label: "React Aria" }
    ]
  },
  {
    flag: "style",
    label: "Style",
    values: ["vega", "nova", "maia", "lyra", "mira", "luma", "rhea", "sera"].map((id) => ({ id, label: id }))
  },
  {
    flag: "theme",
    label: "Theme",
    values: ["neutral", "stone", "zinc", "gray", "mauve", "olive", "mist", "taupe"].map((id) => ({ id, label: id }))
  },
  {
    flag: "icons",
    label: "Icons",
    values: [
      ...["lucide", "tabler", "hugeicons", "phosphor", "remixicon"].map((id) => ({ id, label: id })),
      { id: "@buildkitgg/shadcn-icons-fluent", label: "fluent" }
    ]
  }
] as const

export type Flag = (typeof OPTIONS)[number]["flag"]

export type Choices = Record<Flag, string>

/** The site's own settings, which its postinstall passes to shadcn-sync */
export const DEFAULTS: Choices = { base: "base", style: "vega", theme: "neutral", icons: "lucide" }
