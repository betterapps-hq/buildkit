# @buildkitgg/shadcn-icons-fluent

An icon adapter for shadcn components: a mapping from every Lucide icon the shadcn registry uses to a
[Fluent UI icon](https://github.com/microsoft/fluentui-system-icons). Its default export is plain data:

```ts
import fluent from "@buildkitgg/shadcn-icons-fluent"

fluent.package // "@fluentui/react-icons"
fluent.icons.XIcon // { name: "DismissRegular" }
```

The planned `buildkit-shadcn` command reads it at build time to swap the icons, so the built components import Fluent
directly. `@fluentui/react-icons` is a peer dependency, so the app controls its version.

## Icons

The mapping uses Fluent's unsized Regular icons. They render at `1em`, so the size classes shadcn components put on
icons control their size, as they do for Lucide.

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
longer uses, or when a Fluent export doesn't exist or doesn't render.

After a shadcn update, run `pnpm fixture` in this package to record the registry's icons again, map any new ones, and
commit both files.

See the [shadcn sync plan](../../../docs/platform-planning/shadcn-sync.md#icons) for the adapter contract.
