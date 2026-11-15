/** One Lucide icon's replacement: the module that exports it, its export name, and props for libraries that differ. */
export interface ShadcnIconReplacement {
  /** The export the generated components import in place of the Lucide icon. */
  readonly name: string
  /** The import specifier of the module that exports it. */
  readonly module: string
  /** Props to pass when the library sizes or labels icons differently from Lucide. */
  readonly props?: Readonly<Record<string, string | number | boolean>>
}

/** Maps every Lucide icon the shadcn registry uses to an export of another icon library. */
export interface ShadcnIconAdapter {
  /** The icon library the app installs; every replacement's module belongs to it. */
  readonly package: string
  /** A stylesheet the icons need. Sync imports it into a cascade layer below Tailwind's utilities. */
  readonly styles?: string
  /** Keyed by Lucide export name. */
  readonly icons: Readonly<Record<string, ShadcnIconReplacement>>
}

const svg = "@fluentui/react-icons/headless/svg"

/**
 * Fluent UI's unsized Regular icons from its headless entry, which styles icons with a static stylesheet instead of
 * CSS-in-JS. Layered below the utilities, that stylesheet lets the classes shadcn components put on icons, such as
 * `hidden` and `size-4`, apply as they do for Lucide.
 */
const fluent = {
  package: "@fluentui/react-icons",
  styles: "@fluentui/react-icons/headless/styles.css",
  icons: {
    ArrowDownIcon: { name: "ArrowDownRegular", module: `${svg}/arrow-down` },
    CheckIcon: { name: "CheckmarkRegular", module: `${svg}/checkmark` },
    ChevronDownIcon: { name: "ChevronDownRegular", module: `${svg}/chevron-down` },
    ChevronLeftIcon: { name: "ChevronLeftRegular", module: `${svg}/chevron-left` },
    ChevronRightIcon: { name: "ChevronRightRegular", module: `${svg}/chevron-right` },
    ChevronUpIcon: { name: "ChevronUpRegular", module: `${svg}/chevron-up` },
    CircleCheckIcon: { name: "CheckmarkCircleRegular", module: `${svg}/checkmark-circle` },
    CopyIcon: { name: "CopyRegular", module: `${svg}/copy` },
    InfoIcon: { name: "InfoRegular", module: `${svg}/info` },
    Loader2Icon: { name: "SpinnerIosRegular", module: `${svg}/spinner-ios` },
    MinusIcon: { name: "SubtractRegular", module: `${svg}/subtract` },
    MoreHorizontalIcon: { name: "MoreHorizontalRegular", module: `${svg}/more-horizontal` },
    OctagonXIcon: { name: "DismissCircleRegular", module: `${svg}/dismiss-circle` },
    PanelLeftIcon: { name: "PanelLeftRegular", module: `${svg}/panel-left` },
    SearchIcon: { name: "SearchRegular", module: `${svg}/search` },
    TriangleAlertIcon: { name: "WarningRegular", module: `${svg}/warning` },
    XIcon: { name: "DismissRegular", module: `${svg}/dismiss` }
  }
} satisfies ShadcnIconAdapter

export default fluent
