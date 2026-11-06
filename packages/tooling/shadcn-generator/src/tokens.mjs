// shadcn's CSS variables as design tokens in the DTCG format (the Format and Resolver modules, 2025.10). A token's path
// is its variable's name split at each hyphen, so `card.foreground` is `--card-foreground`.

import { isDeepStrictEqual } from "node:util"
import { transform } from "lightningcss"
import { describeToken } from "./token-descriptions.mjs"

/** Where Buildkit's own data sits in `$extensions`. */
const extension = "gg.buildkit"

/**
 * A style's tokens as a DTCG resolver: one set with the light values, and a `theme` modifier whose `dark` context
 * replaces the tokens that differ in dark mode. These are the package defaults, not an app's overrides.
 */
export function designTokens({ style, revision, repository, palette, cssVariables, tailwind }) {
  const light = { ...cssVariables.theme, ...cssVariables.light, ...tailwindTokens(tailwind) }
  const dark = { ...light, ...cssVariables.dark }
  const groups = groupNames(Object.keys(light))
  const lightTokens = tokensFrom(light, groups)
  const darkTokens = tokensFrom(dark, groups)

  const changed = Object.fromEntries(
    Object.entries(darkTokens).filter(([name, token]) => !isDeepStrictEqual(token, lightTokens[name]))
  )

  return {
    name: `shadcn ${style}`,
    version: "2025.10",
    description: `The default tokens of the shadcn ${style} style, in light and dark themes.`,
    sets: { shadcn: { sources: [tree(lightTokens, groups)] } },
    modifiers: {
      theme: { contexts: { light: [], dark: [tree(changed, groups)] }, default: "light" }
    },
    resolutionOrder: [{ $ref: "#/sets/shadcn" }, { $ref: "#/modifiers/theme" }],
    $extensions: { [extension]: { style, palette, upstream: { repository, revision } } }
  }
}

/**
 * Tailwind's theme variables, by name without `--`. Its `--color-primary: var(--primary)` names the same token as
 * `--primary`, which the path `color.primary` matches either way, so it's left out.
 */
function tailwindTokens(tailwind) {
  return Object.fromEntries(
    Object.entries(tailwind)
      .map(([name, value]) => [name.replace(/^--/, ""), value])
      .filter(([name, value]) => !name.startsWith("color-") || value !== `var(--${name.slice(6)})`)
  )
}

/** The names that other names extend, as `card` for `card-foreground`, whose own token goes in `$root`. */
function groupNames(names) {
  return new Set(names.filter((name) => names.some((other) => other.startsWith(`${name}-`))))
}

/** Each variable as a DTCG token, by name. */
export function tokensFrom(definitions, groups = groupNames(Object.keys(definitions))) {
  const tokens = {}

  function token(name, ancestors = []) {
    if (ancestors.includes(name)) {
      throw new Error(`Cyclic token reference: ${[...ancestors, name].join(" -> ")}`)
    }

    if (!Object.hasOwn(definitions, name)) {
      throw new Error(`Missing token reference: --${name}`)
    }

    if (tokens[name]) {
      return tokens[name]
    }

    const source = definitions[name]
    const alias = /^var\(\s*--([\w-]+)\s*\)$/.exec(source)?.[1]

    if (alias && Object.hasOwn(definitions, alias)) {
      tokens[name] = {
        $type: token(alias, [...ancestors, name]).$type,
        $value: `{${aliasPath(alias, groups)}}`,
        $description: describeToken(name)
      }
    } else {
      const concrete = substitute(source, (reference) => token(reference, [...ancestors, name]), definitions)
      tokens[name] = { ...typedValue(concrete), $description: describeToken(name) }

      // DTCG has no form for an expression such as calc(), so the value is computed and the CSS kept beside it.
      if (source.includes("var(")) {
        tokens[name].$extensions = { [extension]: { css: source } }
      }
    }

    return tokens[name]
  }

  for (const name of Object.keys(definitions)) {
    token(name)
  }

  return Object.fromEntries(Object.keys(definitions).map((name) => [name, tokens[name]]))
}

/** The CSS with each var() replaced by the value it refers to, innermost first, or by its fallback. */
function substitute(source, resolve, definitions) {
  let value = source

  while (value.includes("var(")) {
    let changed = false
    value = value.replace(/var\(\s*--([\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, name, fallback) => {
      changed = true

      if (Object.hasOwn(definitions, name)) {
        return cssOf(resolve(name))
      }

      if (fallback !== undefined) {
        return fallback.trim()
      }

      throw new Error(`Missing token reference: --${name}`)
    })

    if (!changed) {
      throw new Error(`Unsupported variable expression: ${source}`)
    }
  }

  return value
}

/** A token's value written back as CSS, for an expression that refers to it. */
function cssOf(token) {
  const value = token.$value

  if (token.$type === "dimension") {
    return `${value.value}${value.unit}`
  }

  const alpha = value.alpha === undefined ? "" : ` / ${value.alpha}`

  if (value.colorSpace === "srgb") {
    return `rgb(${value.components.map((part) => part * 255).join(" ")}${alpha})`
  }

  return `${value.colorSpace}(${value.components.join(" ")}${alpha})`
}

/** The path an alias refers to: the name's parts, and `$root` for a name others extend. */
function aliasPath(name, groups) {
  return [...name.split("-"), ...(groups.has(name) ? ["$root"] : [])].join(".")
}

/** A concrete value as a DTCG dimension or color. Values that need layout context fail rather than guess. */
function typedValue(value) {
  if (/^(?:calc\(|min\(|max\(|clamp\(|-?[\d.]+(?:px|rem)$|0$)/.test(value)) {
    // Let the CSS compiler evaluate calc() instead of duplicating CSS arithmetic.
    const css = transform({ filename: "token.css", code: Buffer.from(`a{border-radius:${value}}`), minify: true })
    const match = /border-radius:(-?[\d.]+)(px|rem)?[;}]/.exec(css.code.toString())

    if (!match) {
      throw new Error(`Token needs layout context or has an unsupported dimension: ${value}`)
    }

    return { $type: "dimension", $value: { value: round(Number(match[1])), unit: match[2] ?? "px" } }
  }

  let color
  transform({
    filename: "token.css",
    code: Buffer.from(`a{color:${value}}`),
    visitor: {
      Color(found) {
        color ??= found
      }
    }
  })
  const dtcgColor = color && colorValue(color)

  if (!dtcgColor) {
    throw new Error(`Unsupported or context-dependent token value: ${value}`)
  }

  return { $type: "color", $value: dtcgColor }
}

/** The channels of each color space Lightning CSS parses, in DTCG's order. */
const channels = {
  oklch: ["l", "c", "h"],
  lch: ["l", "c", "h"],
  oklab: ["l", "a", "b"],
  lab: ["l", "a", "b"],
  srgb: ["r", "g", "b"],
  "srgb-linear": ["r", "g", "b"],
  "display-p3": ["r", "g", "b"],
  "a98-rgb": ["r", "g", "b"],
  "prophoto-rgb": ["r", "g", "b"],
  rec2020: ["r", "g", "b"],
  "xyz-d50": ["x", "y", "z"],
  "xyz-d65": ["x", "y", "z"]
}

/** A Lightning CSS color as a DTCG color value, in the color space it was written in. */
function colorValue(color) {
  // Lightning CSS reads hex, rgb() and hsl() as 8-bit sRGB channels.
  const rgb = color.type === "rgb"
  const colorSpace = rgb ? "srgb" : color.type
  const names = channels[colorSpace]

  if (!names) {
    return undefined
  }

  const components = names.map((name) => round(rgb ? color[name] / 255 : color[name]))

  const value = { colorSpace, components }

  if (color.alpha < 1) {
    value.alpha = round(color.alpha, 3)
  }

  return value
}

/** Lightning CSS holds numbers as 32-bit floats; six significant digits is what they carry. */
function round(number, digits = 6) {
  return Number(number.toPrecision(digits))
}

/** Tokens nested by their paths, a name that others extend holding its own token in `$root`. */
function tree(tokens, groups) {
  const root = {}

  for (const [name, token] of Object.entries(tokens)) {
    let node = root

    for (const part of name.split("-")) {
      node = node[part] ??= {}
    }

    if (groups.has(name)) {
      node.$root = token
    } else {
      Object.assign(node, token)
    }
  }

  return root
}
