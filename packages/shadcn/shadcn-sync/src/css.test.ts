import { describe, expect, it } from "vite-plus/test"
import { checkTailwindStylesheet, compileStyles, specificity, tailwindInput, tailwindStylesheet } from "./css.js"

const cliCss = `@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --primary: oklch(0.2 0 0);
}

@theme inline {
  --color-primary: var(--primary);
}

@layer base {
  body {
    @apply bg-background;
  }
}
`

/** The sublayer each of a stylesheet's rules sits in, keyed by its selector. */
function layersBySelector(css: string) {
  return Object.fromEntries(
    [...css.matchAll(/@layer (utilities\.u\d+) \{\n([^]*?)\n\}(?=\n@layer|\n$)/g)].flatMap(([, layer, body]) =>
      [...(body ?? "").matchAll(/^\s*(\S[^{\n]*?) \{/gm)].map(([, selector]) => [selector, layer])
    )
  )
}

function layerIndex(layer: string | undefined) {
  return Number(layer?.slice("utilities.u".length))
}

describe("specificity", () => {
  it.each([
    [".px-4", 1000],
    [".hover\\:bg-primary:hover", 2000],
    [".group-hover\\:x:is(:where(.group):hover *)", 2000],
    [".\\[\\&_svg\\]\\:size-4 svg", 1001],
    ['.data-\\[state\\=open\\]\\:p-2[data-state="open"]', 2000],
    [".x:where(.a, .b)", 1000],
    [".x::before", 1001],
    ["#id .x:not(.a, .b.c)", 1003000]
  ])("%s is %d", (selector, value) => {
    expect(specificity(selector)).toBe(value)
  })
})

describe("tailwindInput", () => {
  it("swaps Tailwind's full import for its theme and utilities and drops the CLI's base layer", () => {
    const input = tailwindInput(cliCss)

    expect(input).toContain('@import "tailwindcss/theme.css" layer(theme);')
    expect(input).not.toContain('@import "tailwindcss";')
    expect(input).not.toContain("@apply bg-background")
    expect(input).toContain('@import "tw-animate-css";')
  })
})

describe("compileStyles", () => {
  it("keeps Tailwind's precedence in layers, whatever order the stylesheets load in", async () => {
    const candidates = new Map([
      ["first", new Set(["md:px-6", "data-[state=open]:p-2", "flex"])],
      ["second", new Set(["px-4", "p-2", "hover:bg-primary", "bg-primary", "dark:bg-primary"])]
    ])

    const all = new Set([...candidates.values()].flatMap((words) => [...words]))
    const styles = await compileStyles(cliCss, process.cwd(), all, candidates, "@acme/icons/styles.css")
    const first = layersBySelector(styles.components.get("first") ?? "")
    const second = layersBySelector(styles.components.get("second") ?? "")

    // Equal specificity: Tailwind's order decides, so the later rule sits in a higher layer.
    expect(layerIndex(first[".md\\:px-6"])).toBeGreaterThan(layerIndex(second[".px-4"]))
    expect(layerIndex(second[".px-4"])).toBeGreaterThan(layerIndex(second[".p-2"]))
    // Higher specificity still wins over a later, less specific rule.
    expect(layerIndex(first['.data-\\[state\\=open\\]\\:p-2[data-state="open"]'])).toBeGreaterThan(
      layerIndex(first[".md\\:px-6"])
    )
    // Rules that never compete share a layer.
    expect(first[".flex"]).toBe(second[".p-2"])

    for (const css of [styles.shared, ...styles.components.values()]) {
      expect(css.startsWith("@layer properties, theme, base, components, utilities;\n@layer utilities.u0")).toBe(true)
    }

    expect(styles.shared).toContain('@import "@acme/icons/styles.css" layer(base);')
    expect(styles.shared).toContain("--primary: oklch(0.2 0 0)")
    expect(styles.shared).toContain(":where(a)[data-slot]")
    expect(styles.shared).not.toMatch(/^\.px-4/m)
    expect(styles.components.get("second")).not.toContain("md\\:px-6")
  })

  it("refuses stylesheets that load Tailwind plugins", async () => {
    await expect(
      compileStyles(`${cliCss}\n@plugin "./plugin.js";`, process.cwd(), new Set(["flex"]), new Map(), undefined)
    ).rejects.toThrow("Tailwind plugin or config")
  })
})

describe("tailwindStylesheet", () => {
  // The CLI's stylesheet maps every color its base layer applies; the shared fixture maps only the primary.
  const styleCss = cliCss
    .replace('@import "tw-animate-css";', '@import "tw-animate-css";\n@import "shadcn/tailwind.css";')
    .replace(
      "--color-primary: var(--primary);",
      "--color-primary: var(--primary);\n  --color-background: var(--primary);"
    )

  it("sources the generated JavaScript and inlines the style's imports, leaving Tailwind to the app", () => {
    const stylesheet = tailwindStylesheet(styleCss, process.cwd(), "@acme/icons/styles.css")

    expect(stylesheet.startsWith('@import "@acme/icons/styles.css" layer(base);\n@source "./**/*.js";\n')).toBe(true)
    expect(stylesheet).not.toContain('@import "tailwindcss"')
    expect(stylesheet).not.toContain('@import "tw-animate-css"')
    expect(stylesheet).not.toContain('@import "shadcn/tailwind.css"')
    expect(stylesheet).toContain("--tw-enter-opacity")
    expect(stylesheet).toContain("@custom-variant data-open")
    expect(stylesheet).toContain("@keyframes accordion-down")
    expect(stylesheet).toContain("@custom-variant dark (&:is(.dark *));")
    expect(stylesheet).toContain("--primary: oklch(0.2 0 0)")
    expect(stylesheet).toContain("--color-primary: var(--primary)")
    expect(stylesheet).toContain("@apply bg-background")
  })

  it("compiles after the app's Tailwind, with shadcn's variants and the dark variant", async () => {
    const css = await checkTailwindStylesheet(
      tailwindStylesheet(styleCss, process.cwd(), "@acme/icons/styles.css"),
      process.cwd(),
      ["data-open:bg-primary", "dark:bg-primary", "animate-in"]
    )

    expect(css).toContain('.data-open\\:bg-primary:where([data-open]:not([data-open="false"]))')
    expect(css).toContain(".dark\\:bg-primary:is(.dark *)")
    // `@theme inline` puts the theme variable itself in the utility.
    expect(css).toContain("background-color: var(--primary)")
    expect(css).toContain("animation: enter")
  })

  it("refuses an import it can't inline", () => {
    expect(() => tailwindStylesheet('@import "tw-animate-css" layer(x);', process.cwd(), undefined)).toThrow(
      "Sync can't inline"
    )
  })
})
