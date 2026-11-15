# @buildkitgg/shadcn-icons-fluent

An icon adapter for shadcn components: a mapping from every Lucide icon the shadcn registry uses to a
[Fluent UI icon](https://github.com/microsoft/fluentui-system-icons). Its default export is plain data:

```ts
import fluent from "@buildkitgg/shadcn-icons-fluent"

fluent.package // "@fluentui/react-icons"
fluent.styles // "@fluentui/react-icons/headless/styles.css"
fluent.icons.XIcon // { name: "DismissRegular", module: "@fluentui/react-icons/headless/svg/dismiss" }
```

`buildkit-shadcn` from [`@buildkitgg/shadcn-sync`](../shadcn-sync/README.md) reads it at build time to swap the icons,
so the built components import Fluent directly. `@fluentui/react-icons` 2.0.332 or later is a peer dependency, so the
app controls its version.

Install both packages and pass the adapter to sync:

```bash
pnpm add @fluentui/react-icons
pnpm add -D @buildkitgg/shadcn-icons-fluent
pnpm exec buildkit-shadcn set --icons @buildkitgg/shadcn-icons-fluent
```

## Icons

The mapping uses Fluent's unsized Regular icons from its headless entry, one module per icon. They render at `1em`, so
the size classes shadcn components put on icons control their size, as they do for Lucide.

Headless icons are styled by `@fluentui/react-icons/headless/styles.css` instead of Fluent's CSS-in-JS runtime. Sync
imports that stylesheet into a cascade layer below the components' utilities, so classes such as `hidden` still apply.

| Lucide               | Fluent                   |
| -------------------- | ------------------------ |
| `ArrowDownIcon`      | `ArrowDownRegular`       |
| `CheckIcon`          | `CheckmarkRegular`       |
| `ChevronDownIcon`    | `ChevronDownRegular`     |
| `ChevronLeftIcon`    | `ChevronLeftRegular`     |
| `ChevronRightIcon`   | `ChevronRightRegular`    |
| `ChevronUpIcon`      | `ChevronUpRegular`       |
| `CircleCheckIcon`    | `CheckmarkCircleRegular` |
| `CopyIcon`           | `CopyRegular`            |
| `InfoIcon`           | `InfoRegular`            |
| `Loader2Icon`        | `SpinnerIosRegular`      |
| `MinusIcon`          | `SubtractRegular`        |
| `MoreHorizontalIcon` | `MoreHorizontalRegular`  |
| `OctagonXIcon`       | `DismissCircleRegular`   |
| `PanelLeftIcon`      | `PanelLeftRegular`       |
| `SearchIcon`         | `SearchRegular`          |
| `TriangleAlertIcon`  | `WarningRegular`         |
| `XIcon`              | `DismissRegular`         |

## Keeping the mapping complete

`fixtures/registry-icons.json` records which Lucide icons the registry's components use, and the components that use
each one. The tests fail when a recorded icon has no Fluent replacement, when the mapping keeps an icon the registry no
longer uses, when a module doesn't export its icon, or when an icon doesn't render with the component's size class.

After a shadcn update, run `pnpm fixture` in this package to record the registry's icons again, map any new ones, and
commit both files.

The default export satisfies `ShadcnIconAdapter` from `@buildkitgg/shadcn-sync/adapter`. See the
[shadcn sync plan](../../../docs/platform-planning/shadcn-sync.md#icons) for the adapter contract.
