import assert from "node:assert/strict"
import { test } from "node:test"
import { designTokens, tokensFrom } from "./tokens.mjs"

test("writes colors and dimensions as DTCG values, computing calc() and keeping its CSS", () => {
  const tokens = tokensFrom({
    radius: "0.625rem",
    "radius-sm": "calc(var(--radius) * 0.6)",
    primary: "oklch(0.205 0 0)",
    border: "oklch(1 0 0 / 10%)",
    ring: "#ff0000"
  })

  assert.deepEqual(tokens["radius-sm"], {
    $type: "dimension",
    $value: { value: 0.375, unit: "rem" },
    $description: "Corner radius at the sm size, derived from the base radius.",
    $extensions: { "gg.buildkit": { css: "calc(var(--radius) * 0.6)" } }
  })
  assert.deepEqual(tokens.primary.$value, { colorSpace: "oklch", components: [0.205, 0, 0] })
  assert.deepEqual(tokens.border.$value, { colorSpace: "oklch", components: [1, 0, 0], alpha: 0.1 })
  assert.deepEqual(tokens.ring.$value, { colorSpace: "srgb", components: [1, 0, 0] })
})

test("writes a variable that only refers to another as an alias, through `$root` for a group's own token", () => {
  const tokens = tokensFrom({ radius: "0.625rem", "radius-lg": "var(--radius)", primary: "oklch(0.205 0 0)" })

  assert.deepEqual(tokens["radius-lg"], {
    $type: "dimension",
    $value: "{radius.$root}",
    $description: "Corner radius at the lg size, derived from the base radius."
  })
})

test("rejects missing references, cycles, context-dependent values and undescribed variables", () => {
  assert.throws(() => tokensFrom({ primary: "var(--missing)" }), /Missing/)
  assert.throws(() => tokensFrom({ primary: "var(--ring)", ring: "var(--primary)" }), /Cyclic/)
  assert.throws(() => tokensFrom({ primary: "currentColor" }), /context-dependent/)
  assert.throws(() => tokensFrom({ "brand-glow": "#fff" }), /--brand-glow has no description/)
  assert.deepEqual(tokensFrom({ primary: "var(--missing, #fff)" }).primary.$value, {
    colorSpace: "srgb",
    components: [1, 1, 1]
  })
})

test("nests tokens by name, puts what changes in dark mode in the dark context, and leaves out Tailwind's aliases", () => {
  const resolver = designTokens({
    style: "nova",
    repository: "https://github.com/shadcn-ui/ui",
    revision: "abc123",
    palette: "neutral",
    cssVariables: {
      light: { card: "oklch(1 0 0)", "card-foreground": "oklch(0.145 0 0)", radius: "0.625rem" },
      dark: { card: "oklch(0.205 0 0)", "card-foreground": "oklch(0.145 0 0)" }
    },
    tailwind: { "--color-card": "var(--card)", "--radius-sm": "calc(var(--radius) * 0.6)" }
  })

  const [base] = resolver.sets.shadcn.sources
  const [dark] = resolver.modifiers.theme.contexts.dark

  assert.equal(resolver.version, "2025.10")
  assert.deepEqual(resolver.resolutionOrder, [{ $ref: "#/sets/shadcn" }, { $ref: "#/modifiers/theme" }])
  assert.deepEqual(Object.keys(base), ["card", "radius"])
  assert.deepEqual(Object.keys(base.card), ["$root", "foreground"])
  assert.deepEqual(dark, {
    card: {
      $root: {
        $type: "color",
        $value: { colorSpace: "oklch", components: [0.205, 0, 0] },
        $description: "Background of cards."
      }
    }
  })
  assert.deepEqual(resolver.$extensions["gg.buildkit"], {
    style: "nova",
    palette: "neutral",
    upstream: { repository: "https://github.com/shadcn-ui/ui", revision: "abc123" }
  })
})
