import type { ComponentProps } from "react"

type LinkProps = ComponentProps<"a"> & { href: string }

/**
 * A link. One that leaves this page opens in a new tab, which gets no handle on this window and no referrer. In-page
 * anchors stay in the tab.
 */
export function Link({ href, children, ...props }: LinkProps) {
  const leaves = !href.startsWith("#")

  return (
    <a href={href} {...(leaves ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...props}>
      {children}
    </a>
  )
}
