import assert from "node:assert/strict"
import { test } from "node:test"
import { createStyleMap, transformStyle } from "shadcn/utils"
import { snapshot } from "./shared.mjs"
import { adaptStyleMap } from "./styles.mjs"

const parts = ["Item", "CheckboxItem", "RadioItem", "SubTrigger"]

const components = {
  "ui/dropdown-menu.tsx": "DropdownMenu",
  "ui/context-menu.tsx": "ContextMenu",
  "ui/menubar.tsx": "Menubar"
}

// The root element's className: the first one after the component's own function declaration.
function rootClasses(source, component) {
  const start = source.indexOf(`function ${component}(`)
  assert.ok(start >= 0, `Missing ${component}`)

  return /className=\{cn\(\s*"([^"]*)"/.exec(source.slice(start))?.[1] ?? ""
}

test("every menu item sizes the icons it's given in every style", async () => {
  const data = snapshot()

  for (const [style, css] of Object.entries(data.styles)) {
    const styleMap = adaptStyleMap(createStyleMap(css))
    const size = /\[&_svg:not\(\[class\*='size-'\]\)\]:size-\S+/.exec(styleMap["cn-menubar-item"])?.[0]
    assert.ok(size, `${style}: cn-menubar-item has no icon size`)

    for (const [filename, prefix] of Object.entries(components)) {
      const source = await transformStyle(data.sources[filename], { styleMap })

      for (const part of parts) {
        assert.ok(rootClasses(source, prefix + part).includes(size), `${style}: ${prefix}${part} doesn't size icons`)
      }
    }
  }
})

test("a menu item family without an item icon size stops generation", () => {
  assert.throws(
    () => adaptStyleMap({ "cn-menubar-item": "gap-2", "cn-menubar-checkbox-item": "gap-2" }),
    /Review upstream menu icon sizes/
  )
})

test("an icon size a part already has is kept", () => {
  const styleMap = {
    "cn-menubar-item": "[&_svg:not([class*='size-'])]:size-4",
    "cn-menubar-radio-item": "[&_svg:not([class*='size-'])]:size-3.5"
  }

  assert.deepEqual(adaptStyleMap(styleMap), styleMap)
})
