const menuItem = /^cn-(dropdown-menu|context-menu|menubar)-(item|checkbox-item|radio-item|sub-trigger)$/
const iconSize = /\[&_svg:not\(\[class\*='size-'\]\)\]:size-\S+/

/**
 * Give every menu item part the icon size its family's plain item uses. Upstream leaves it off
 * `cn-menubar-checkbox-item` in every style, so an icon passed to `MenubarCheckboxItem` renders at its own size.
 */
export function adaptStyleMap(styleMap) {
  const adapted = { ...styleMap }

  for (const [name, classes] of Object.entries(styleMap)) {
    const match = menuItem.exec(name)

    if (!match || iconSize.test(classes)) {
      continue
    }

    const size = iconSize.exec(styleMap[`cn-${match[1]}-item`] ?? "")?.[0]

    if (!size) {
      throw new Error(`Review upstream menu icon sizes: cn-${match[1]}-item has none for ${name}`)
    }

    adapted[name] = `${classes} ${size}`
  }

  return adapted
}
