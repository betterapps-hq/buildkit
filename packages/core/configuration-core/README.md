# @buildkitgg/configuration-core

Typed app configuration, such as rollout switches, experiment variants, and limits, that loads from whichever service
you plug in and falls back to your defaults. Developers can override any setting while testing. No React or vendor SDK
dependency.

```sh
pnpm add @buildkitgg/configuration-core
```

## Configuration and preferences

Configuration holds decisions the app or a provider makes: a rollout switch, an experiment variant, a page-size limit,
or a default language. A preference is a user's choice, such as their language or theme, and belongs in
`@buildkitgg/preferences-core`.

```ts
const language = preferences.get("language") ?? config.get("defaultLanguage")
```

The app decides that precedence. Resetting the language preference falls back to the configured default without changing
configuration. A developer override is a diagnostic control, not the user's language preference. configuration-core
saves overrides through preferences-core, under a storage key the app chooses.

## Usage

```ts
import { createConfiguration } from "@buildkitgg/configuration-core"

const config = createConfiguration({
  defaults: { newCheckout: false, pageSize: 20 },
  context: { userId: "customer-42", cohort: "standard" },
  provider: {
    async load(context, { signal }) {
      // Call your SDK or validated application endpoint here, passing `signal` so it can cancel.
      return { newCheckout: context.cohort === "early-access" }
    }
  },
  overrides: { storage: "localStorage", key: "my-app:configuration-overrides" }
})

await config.refresh()
config.get("newCheckout") // boolean; unknown names are compile errors
config.override("newCheckout", true)
config.reset("newCheckout") // back to the provider value, or the default
await config.setContext({ userId: "customer-43", cohort: "early-access" })
config.dispose()
```

## Types and validation

Setting names, value types, and the targeting context are inferred from the objects you pass. For narrower unions, pass
the types explicitly with `createConfiguration<Settings, Context>(options)`, and add a validator such as
`validate: { variant: value => value === "control" || value === "experiment" }`.

Settings are booleans, strings, or finite numbers. A default of any other type throws. At runtime, the client rejects
provider values of the wrong type, and validators constrain unions and ranges without a schema library. Unknown provider
keys are ignored, but one invalid value for a known key rejects the whole evaluation. TypeScript declarations alone
don't validate external JSON.

## Providers

A provider connects a service such as LaunchDarkly, ECS, or Azure App Configuration; no adapters for those services are
bundled. It can also wrap a local map or your own endpoint. Context is whatever object your app uses for targeting, not
a fixed user schema.

```ts
import type { ConfigurationProvider } from "@buildkitgg/configuration-core"

type Settings = { newCheckout: boolean; defaultLanguage: string }
type Context = { userId: string; region: string }

// Application-owned service integration, implemented with your chosen SDK.
declare const service: {
  evaluate(context: Readonly<Context>, signal: AbortSignal): Promise<Partial<Settings>>
  onChange(listener: () => void): () => void
}

const provider: ConfigurationProvider<Settings, Context> = {
  load: (context, { signal }) => service.evaluate(context, signal),
  subscribe: (listener) => service.onChange(listener)
}
```

`load(context, { signal })` returns every setting the service resolves, as a `Partial<Settings>`, synchronously or as a
promise. Missing settings use their defaults. The optional `subscribe(onChange)` tells the client to reload and returns
an unsubscribe function. It signals that values changed; it doesn't carry them. If your service sends patches, the
adapter keeps the current values and returns them all from `load`.

The adapter owns SDK setup, authentication, targeting rules, polling, transport, and exposure tracking, and keeps any
SDK-specific metadata. Reading a setting doesn't record an experiment exposure: the client deals only in resolved
setting values. Cancellation is cooperative. If the SDK holds targeting context globally, the adapter must isolate or
serialize context-dependent calls, because the client ignoring a stale response can't undo a change to the SDK's shared
state.

## Lifecycle

Creating a client doesn't load from or subscribe to the provider; call `refresh()` to start. `getSnapshot()` returns
`values`, `context`, `status` (`idle`, `loading`, `ready`, or `error`), and `error`. A provider error doesn't reject
`refresh()`; it appears in the snapshot, and the client keeps the last successful evaluation for the same context.

`setContext()` replaces the whole context, clears the previous provider values, and reloads. A superseded request gets
an abort signal, and its response is ignored even if the provider ignores the signal.

Snapshots and context are shallowly frozen; treat nested context data as immutable. Create a client per application, or
per request on the server, and never share a targeted client across server users. `dispose()` aborts pending work and
removes subscriptions, but doesn't shut down a shared vendor SDK. Don't reuse a disposed client.

## Overrides

An override beats the provider value, which beats the default. Overrides are off unless you pass `overrides: true` (kept
in memory) or `overrides: { storage: "localStorage" | "sessionStorage", key }`, and calling `override`, `reset`, or
`resetAll` while they're off throws. Storage always needs a key. You only call those three methods; the client handles
persistence, and it never saves provider values as overrides.

With local storage, overrides follow changes made in other tabs of the same origin. Session storage keeps them to the
browser session. Malformed or invalid saved values are ignored, and the client falls back to memory when storage is
unavailable. Overrides survive context changes until reset. Turn them on deliberately, for development: client-side
configuration isn't an authorization boundary.

## Framework bindings

`getSetting(key)` returns a stable `{ value, defaultValue, source }` snapshot, where `source` is `default`, `provider`,
or `override`. `subscribe()` is what bindings such as `@buildkitgg/react-configuration` use. The server snapshot always
holds the initial defaults and context, so hydration is deterministic; load provider values on the client after
hydration.
