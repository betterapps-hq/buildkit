# Theming

[shadcn components](README.md)

The components read shadcn's CSS variables. Sync puts the chosen theme's values on `:root` and `.dark`, inside a cascade
layer, so the app's own unlayered CSS overrides them wherever it's imported:

```css
:root {
  --primary: #6d28d9;
  --primary-foreground: #ffffff;
  --ring: #7c3aed;
  --radius: 0.75rem;
}

.dark {
  --primary: #c4b5fd;
  --primary-foreground: #2e1065;
  --ring: #a78bfa;
}
```

| Group             | Variables                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page              | `--background`, `--foreground`                                                                                                                                                    |
| Surfaces          | `--card`, `--card-foreground`, `--popover`, `--popover-foreground`                                                                                                                |
| Actions           | `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`                                                                                                      |
| Supporting colors | `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`                                                                                               |
| Controls          | `--border`, `--input`, `--ring`                                                                                                                                                   |
| Shape             | `--radius` (a CSS length)                                                                                                                                                         |
| Charts            | `--chart-1` through `--chart-5`                                                                                                                                                   |
| Sidebar           | `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` |

Colors take full CSS color values such as hex, `rgb()` or `oklch()`. Set each foreground with its background and check
the contrast. Related variables are independent: changing `--primary` doesn't change `--sidebar-primary` or the chart
colors.

## Dark mode

Put the `dark` class on `<html>`, for example with `document.documentElement.classList.toggle("dark", isDark)`. Dialogs
and other portaled content render outside the app's wrapper, so a class on the wrapper doesn't reach them. Apply a
stored preference before first paint to avoid a flash of the wrong theme.

## Fonts and page styles

The compiled CSS doesn't reset the page or style `body`, so the app sets its own page background, text color and fonts,
for example with `var(--background)` and `var(--foreground)`. In Tailwind mode, the style's base layer sets the page's
background and text colors, and fonts stay the app's.

## Tailwind apps

With `--css tailwind`, `@buildkitgg/shadcn/tailwind.css` maps the variables to Tailwind colors such as `bg-muted`, so
the app's own classes use the same theme. Override the variables in the app's stylesheet after that import. See
[Tailwind mode](../../packages/shadcn/shadcn-sync/README.md#tailwind-mode).
