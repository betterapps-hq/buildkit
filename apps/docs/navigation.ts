export type PackageEntry = {
  name: string
  layer: string
  guide: string
  entries: { name: string; link: string }[]
}

const routingTitles = new Map([
  ["router-core", "Core"],
  ["react-routing", "React bindings"],
  ["react-router", "React Router"],
  ["tanstack-router", "TanStack Router"]
])

export function packagePages(name: string) {
  return name === "dev-domains" ? [{ text: "CLI reference", link: "/packages/dev-domains/commands" }] : []
}

// Keep the sidebar and generated indexes in the same order without changing package layers or import paths.
export function documentationSections(catalog: PackageEntry[]) {
  const routingOrder = [...routingTitles.keys()]

  return ["Core", "React", "shadcn", "Fluent UI", "Routing", "Developer tools"].flatMap((text) => {
    const packages = catalog
      .filter((pkg) => (routingTitles.has(pkg.name) ? "Routing" : pkg.layer) === text)
      .sort((left, right) => routingOrder.indexOf(left.name) - routingOrder.indexOf(right.name))
      .map((pkg) => ({ ...pkg, title: routingTitles.get(pkg.name) ?? pkg.name }))

    return packages.length ? [{ text, link: text === "Routing" ? "/routing/" : undefined, packages }] : []
  })
}
