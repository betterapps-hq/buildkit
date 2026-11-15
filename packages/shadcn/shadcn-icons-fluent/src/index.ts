/** One Lucide icon's replacement: the icon library's export, and props to pass when it sizes or labels icons differently. */
export interface ShadcnIconReplacement {
  readonly name: string
  readonly props?: Readonly<Record<string, string | number | boolean>>
}

/** Maps every Lucide icon the shadcn registry uses to an export of another icon library. */
export interface ShadcnIconAdapter {
  /** The icon library the generated components import from. */
  readonly package: string
  /** Keyed by Lucide export name. */
  readonly icons: Readonly<Record<string, ShadcnIconReplacement>>
}

/**
 * Fluent UI's unsized Regular icons. They render at 1em, so the size classes shadcn components put on icons control
 * their size, as they do for Lucide.
 */
const fluent = {
  package: "@fluentui/react-icons",
  icons: {
    ArrowDownIcon: { name: "ArrowDownRegular" },
    CheckIcon: { name: "CheckmarkRegular" },
    ChevronDownIcon: { name: "ChevronDownRegular" },
    ChevronLeftIcon: { name: "ChevronLeftRegular" },
    ChevronRightIcon: { name: "ChevronRightRegular" },
    ChevronUpIcon: { name: "ChevronUpRegular" },
    CircleCheckIcon: { name: "CheckmarkCircleRegular" },
    CopyIcon: { name: "CopyRegular" },
    InfoIcon: { name: "InfoRegular" },
    Loader2Icon: { name: "SpinnerIosRegular" },
    MinusIcon: { name: "SubtractRegular" },
    MoreHorizontalIcon: { name: "MoreHorizontalRegular" },
    OctagonXIcon: { name: "DismissCircleRegular" },
    PanelLeftIcon: { name: "PanelLeftRegular" },
    SearchIcon: { name: "SearchRegular" },
    TriangleAlertIcon: { name: "WarningRegular" },
    XIcon: { name: "DismissRegular" }
  }
} satisfies ShadcnIconAdapter

export default fluent
