# shadcn components

The shadcn CLI copies each component into your app as source, so anyone can edit it, and an edit to one changes every
screen that uses it. [`@buildkitgg/shadcn-sync`](../../packages/shadcn/shadcn-sync/README.md) runs that same CLI, then
builds the stock components into a `@buildkitgg/shadcn` package inside the app. The app picks the primitives, icons,
style and theme, and imports components like any other package. There's no copied source to maintain and no
`components.json` to keep.

## Set up an app

Run the installer in the app's folder:

```sh
pnpm dlx @buildkitgg/shadcn-sync
```

It asks for each choice, installs the packages they need, builds the components, and adds a `postinstall` that runs
sync. The first build writes `shadcn-registry.json` beside `package.json` and adds `@buildkitgg/shadcn` to the app's
`dependencies`. Commit both files with the lockfile, so every install builds the same components without a network
request.

```tsx
import { Button, Card, CardContent } from "@buildkitgg/shadcn"

export function Welcome() {
  return (
    <Card>
      <CardContent>
        <Button>Continue</Button>
      </CardContent>
    </Card>
  )
}
```

Each component brings its own CSS, so there's no stylesheet to import. A production build ships only the CSS of the
components it uses.

See the [package README](../../packages/shadcn/shadcn-sync/README.md) for the commands, setting it up by hand, package
managers and monorepos.

## Choices

| Option        | Picks                                                            |
| ------------- | ---------------------------------------------------------------- |
| `--base`      | The primitives: `base` (Base UI), `radix` or `aria`              |
| `--icons`     | A built-in icon library or an icon adapter package               |
| `--style`     | The shadcn style, such as `nova` or `vega`                       |
| `--theme`     | The color theme, such as `neutral` or `zinc`                     |
| `--css`       | `compiled` CSS, or `tailwind` for an app that runs Tailwind      |
| `--direction` | `ltr`, or `rtl` for logical classes that follow the page's `dir` |

Imports stay the same when a choice changes. See [choosing what sync builds](styles.md).

## Managers and themes

[`@buildkitgg/shadcn-modals-manager`](../../packages/shadcn/shadcn-modals-manager/README.md) and
[`@buildkitgg/shadcn-alerts-manager`](../../packages/shadcn/shadcn-alerts-manager/README.md) render with the app's own
`@buildkitgg/shadcn`, which they list as a peer dependency. Run sync in each app that uses them.
[`@buildkitgg/shadcn-theme`](../../packages/shadcn/shadcn-theme/README.md) switches between light, dark and system
themes, or themes you declare.

## More

- [Choosing what sync builds](styles.md)
- [Theming](theming.md)
- [Text direction and labels](localization.md)
- [Framework integration](integration.md)
- [Example app](../../apps/shadcn-sync-example/README.md)
- [Fluent icon adapter](../../packages/shadcn/shadcn-icons-fluent/README.md)

shadcn documents each component in its [component docs](https://ui.shadcn.com/docs/components).
