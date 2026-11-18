# @buildkitgg/react-configuration

React hooks for [`@buildkitgg/configuration-core`](../../core/configuration-core/README.md). Read typed settings in
components without a provider component or a UI library; a component that reads one setting rerenders only when that
setting changes.

```sh
pnpm add @buildkitgg/react-configuration react
```

```tsx
import { createConfiguration } from "@buildkitgg/react-configuration"

// Create at the application boundary, outside component rendering.
const config = createConfiguration({
  defaults: { newCheckout: false },
  context: {},
  provider: { load: () => ({ newCheckout: true }) }
})
void config.refresh()

function Checkout() {
  const { value } = config.useSetting("newCheckout")
  return <p>{value ? "New checkout" : "Standard checkout"}</p>
}

function FlagStatus() {
  const { status, error } = config.useConfiguration()
  return <p>{error?.message ?? status}</p>
}
```

`config.useSetting(key)` returns the setting's value, its default, and its source (`default`, `provider`, or
`override`), with types inferred from your defaults. Updates to other settings don't rerender it.
`config.useConfiguration()` returns the whole snapshot: values, context, status, and error. Both use
`useSyncExternalStore` and unsubscribe on unmount.

`createConfiguration` returns the core client with these hooks bound to it, so every core method works on the same
object, and the hooks take no client argument. You can destructure the hooks:

```tsx
export const { useSetting, useConfiguration } = config
// Inside a component: useSetting("newCheckout")
// Outside React: config.get("newCheckout"), config.setContext({}), config.reset("newCheckout")
```

Setting names, values, and context are inferred. Pass types explicitly, as `createConfiguration<Settings, Context>`, to
keep declared unions.

## Configuration and preferences

Configuration holds the app's and provider's decisions; preferences hold the user's choices. For a language setting,
read the configured default with `config.useSetting("defaultLanguage")`, keep the user's selection in a preference, and
resolve `selectedLanguage ?? defaultLanguage` in the app. Developer overrides are separate from user preferences, and
the hooks expose neither a preferences API nor vendor-specific types. Override controls call the client's `override`,
`reset`, and `resetAll`. See the [configuration-core README](../../core/configuration-core/README.md) for the provider
contract.

## Lifecycle and server rendering

The app owns creating, loading, and disposing the client; the hooks never start network requests or dispose a shared
client. If you create a client in an effect, create a fresh one in each setup and dispose it in the cleanup, so Strict
Mode can replay the setup safely.

For SSR, create a client per request. The server renders defaults, and the client renders the same defaults while it
hydrates, then shows loaded values and saved overrides. Don't render from `config.get()` on the server when these hooks
handle hydration.
