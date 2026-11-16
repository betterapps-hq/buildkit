/** One Lucide icon's replacement in another icon library. */
export interface ShadcnIconReplacement {
  /** The export to import. */
  readonly name: string
  /** The import specifier for this one icon, such as `@fluentui/react-icons/headless/svg/chevron-down`. */
  readonly module: string
  /** Props to pass when the library sizes or labels icons differently from Lucide. */
  readonly props?: Readonly<Record<string, string | number | boolean>>
}

/**
 * Maps every Lucide icon the shadcn registry uses to another icon library. An adapter package's default export is this
 * plain data; `shadcn-sync` reads it at build time and the generated components import only the icon library.
 */
export interface ShadcnIconAdapter {
  /** The icon library the generated components import from. The app installs it; the adapter declares it as a peer. */
  readonly package: string
  /**
   * A stylesheet the icons need, imported into the `base` cascade layer so Tailwind utilities such as `hidden` still
   * win over it.
   */
  readonly styles?: string
  /** Keyed by Lucide export name. */
  readonly icons: Readonly<Record<string, ShadcnIconReplacement>>
}
