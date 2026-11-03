const docs = __DOCS_URL__

export const links = {
  docs,
  packages: `${docs}packages/`,
  reference: `${docs}reference/`,
  routing: `${docs}routing/`,
  storybook: __STORYBOOK_URL__,
  github: "https://github.com/betterapps-hq/buildkit",
  portless: "https://github.com/vercel-labs/portless"
}

/** The guide page for one package, such as `packageGuide("dev-domains")`. */
export function packageGuide(name: string) {
  return `${links.packages}${name}/`
}
