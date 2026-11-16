# @buildkitgg/shadcn-icons-fluent

An icon adapter for shadcn components: a mapping from every Lucide icon the shadcn registry uses to a
[Fluent UI icon](https://github.com/microsoft/fluentui-system-icons). Its default export is plain data:

```ts
import fluent from "@buildkitgg/shadcn-icons-fluent"

fluent.package // "@fluentui/react-icons"
fluent.styles // "@fluentui/react-icons/headless/styles.css"
fluent.icons.XIcon // { name: "DismissRegular", module: "@fluentui/react-icons/headless/svg/dismiss" }
```

`shadcn-sync` from [`@buildkitgg/shadcn-sync`](../shadcn-sync/README.md) reads it at build time to swap the icons, so
the built components import Fluent directly. `@fluentui/react-icons` 2.0.332 or later is a peer dependency, so the app
controls its version.

Install both packages and pass the adapter to sync:

```bash
pnpm add @fluentui/react-icons
pnpm add -D @buildkitgg/shadcn-icons-fluent
pnpm exec shadcn-sync set --icons @buildkitgg/shadcn-icons-fluent
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

## Fluent icons in your own code

Import Fluent icons in your app as usual:

```tsx
import { AddRegular } from "@fluentui/react-icons"
```

The headless icons stay inside the generated shadcn components. Both sets draw the same icons and keep their own styles,
so they work side by side.

Icons from `@fluentui/react-icons` style themselves with Griffel, Fluent's CSS-in-JS engine. Griffel sets `display` and
`line-height` on each icon with CSS outside any cascade layer, and that CSS beats Tailwind's utilities, which are
layered. So Tailwind classes for those two properties have no effect on the icon itself:

- `size-*`, colors, margins, `shrink-0`, `rotate-*`, `animate-spin` and `opacity-*` work as usual.
- `hidden`, `md:hidden`, `block`, `inline-flex` and `leading-*` don't.

To hide or show an icon, put the class on a wrapper, or use Tailwind's important modifier. An important rule in a layer
beats CSS outside any layer.

```tsx
<span className="md:hidden">
  <AddRegular />
</span>

<AddRegular className="hidden! md:inline!" />
```

## Keeping the mapping complete

`fixtures/registry-icons.json` records which Lucide icons the registry's components use, and the components that use
each one. The tests fail when a recorded icon has no Fluent replacement, when the mapping keeps an icon the registry no
longer uses, when a module doesn't export its icon, or when an icon doesn't render with the component's size class.

After a shadcn update, run `pnpm fixture` in this package to record the registry's icons again, map any new ones, and
commit both files.

The default export satisfies `ShadcnIconAdapter` from `@buildkitgg/shadcn-sync/adapter`. See the
[shadcn sync plan](../../../docs/platform-planning/shadcn-sync.md#icons) for the adapter contract.
