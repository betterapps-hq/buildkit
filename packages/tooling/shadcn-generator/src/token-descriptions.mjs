// What each of shadcn's CSS variables is for, written once for every style. A variable upstream adds without a
// description here fails generation, so the weekly update stops for review instead of publishing an undescribed token.

const descriptions = {
  background: "Page background.",
  foreground: "Text on the page background.",
  card: "Background of cards.",
  "card-foreground": "Text on cards.",
  popover: "Background of popovers, menus, and other floating surfaces.",
  "popover-foreground": "Text in popovers and menus.",
  primary: "Fill for primary buttons and other main actions.",
  "primary-foreground": "Text and icons on primary fills.",
  secondary: "Fill for secondary buttons.",
  "secondary-foreground": "Text and icons on secondary fills.",
  muted: "Subdued backgrounds, such as tab lists and skeletons.",
  "muted-foreground": "Secondary text, such as descriptions and placeholders.",
  accent: "Hover and focus backgrounds, such as the menu item under the pointer.",
  "accent-foreground": "Text on accent backgrounds.",
  destructive: "Fill and text for destructive actions and errors.",
  border: "Borders and dividers.",
  input: "Borders of inputs, selects, and other form fields.",
  ring: "Focus rings.",
  radius: "Base corner radius. The other radius sizes are derived from it.",
  sidebar: "Background of the sidebar.",
  "sidebar-foreground": "Text in the sidebar.",
  "sidebar-primary": "Fill for primary actions and highlights in the sidebar.",
  "sidebar-primary-foreground": "Text and icons on the sidebar's primary fills.",
  "sidebar-accent": "Hover and active backgrounds of sidebar items.",
  "sidebar-accent-foreground": "Text on the sidebar's accent backgrounds.",
  "sidebar-border": "Borders and dividers in the sidebar.",
  "sidebar-ring": "Focus rings in the sidebar."
}

/** Families of variables described by a pattern, as `chart-3` and `radius-2xl`. */
const families = [
  [/^chart-(\d+)$/, (series) => `Chart color for series ${series}.`],
  [/^radius-(\w+)$/, (size) => `Corner radius at the ${size} size, derived from the base radius.`]
]

/** The description of the CSS variable `--name`. */
export function describeToken(name) {
  if (Object.hasOwn(descriptions, name)) {
    return descriptions[name]
  }

  for (const [pattern, describe] of families) {
    const match = pattern.exec(name)

    if (match) {
      return describe(match[1])
    }
  }

  throw new Error(`--${name} has no description. Add one to src/token-descriptions.mjs.`)
}
