// Records which Lucide icons the shadcn registry's components use, for the coverage test.
// Run with `pnpm fixture` after a shadcn update, then commit fixtures/registry-icons.json.
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const registry = "https://ui.shadcn.com/r"

// Icons come from each base's source; styles only change classes, so one style per base covers them.
const styles = ["base-nova", "radix-nova"]
const types = new Set(["registry:ui", "registry:lib", "registry:hook", "registry:component"])
const placeholder = /<IconPlaceholder\b[^>]*?\blucide="([A-Za-z0-9]+)"/gs

async function json(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`${response.status}: ${url}`)
  }

  return response.json()
}

const icons = {}

for (const style of styles) {
  const index = await json(`${registry}/styles/${style}/registry.json`)
  const names = index.items.filter((item) => types.has(item.type)).map((item) => item.name)

  for (let start = 0; start < names.length; start += 8) {
    const items = await Promise.all(
      names.slice(start, start + 8).map((name) => json(`${registry}/styles/${style}/${name}.json`))
    )

    for (const item of items) {
      for (const file of item.files ?? []) {
        for (const [, icon] of (file.content ?? "").matchAll(placeholder)) {
          icons[icon] ??= new Set()
          icons[icon].add(item.name)
        }
      }
    }
  }
}

const sorted = Object.fromEntries(
  Object.keys(icons)
    .sort()
    .map((icon) => [icon, [...icons[icon]].sort()])
)

writeFileSync(
  fileURLToPath(new URL("../fixtures/registry-icons.json", import.meta.url)),
  JSON.stringify({ registry, styles, icons: sorted }, null, 2) + "\n"
)

process.stdout.write(`Recorded ${Object.keys(sorted).length} icons from ${styles.join(" and ")}.\n`)
