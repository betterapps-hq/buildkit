# @buildkitgg/api-mocker

Register HTTP endpoints on an MSW browser worker or Node server. Supply a response, a sequence of responses for a retry
scenario, or an MSW resolver. Install MSW 3 alongside this package as a peer dependency.

## Storybook

Pass the story's MSW worker to the factory during setup. This example assumes the MSW Storybook addon supplies `msw` in
the story context.

```ts
import { createApiMock } from "@buildkitgg/api-mocker"

export const EmptyInbox: Story = {
  beforeEach({ msw }) {
    const api = createApiMock(msw)
    api.get("/api/messages", { data: [] })
  }
}
```

## Spying in tests

Pass an optional `onRequest` callback as the second argument to `createApiMock`. Any function works, including `vi.fn()`
from Vitest and `jest.fn()` from Jest. The package imports only MSW. The callback receives the body of each request
matched by endpoints registered through that instance. Omitting it skips body parsing.

```ts
const onRequest = vi.fn() // In Jest, use jest.fn().
const api = createApiMock(server, onRequest)
api.post("/api/messages", { status: 201 })

await sendMessage({ text: "Hello" })

expect(onRequest).toHaveBeenCalledWith({ text: "Hello" })
```

### Create a spy per endpoint

Define `createApiSpy` in your test utilities. Create the spy when registering each endpoint so that saving a message and
archiving it have separate call histories. This example takes static responses and uses Vitest. In Jest, use
`jest.fn<OnRequest>()` in the same place.

```ts
import { createApiMock, type HandlerTarget, type MockOptions, type OnRequest } from "@buildkitgg/api-mocker"
import { vi } from "vitest"

export function createApiSpy(target: HandlerTarget) {
  function forMethod(method: "get" | "post" | "put" | "patch" | "delete") {
    return (path: string, response?: MockOptions) => {
      const spy = vi.fn<OnRequest>()
      const endpoint = createApiMock(target, spy)[method](path, response)
      return { endpoint, spy }
    }
  }

  return {
    get: forMethod("get"),
    post: forMethod("post"),
    put: forMethod("put"),
    patch: forMethod("patch"),
    delete: forMethod("delete")
  }
}
```

```ts
const api = createApiSpy(server)
const save = api.post("/api/messages", { status: 201 })
const archive = api.post("/api/archive", { status: 204 })

await sendMessage({ text: "Hello" })

expect(save.spy).toHaveBeenCalledWith({ text: "Hello" })
expect(archive.spy).not.toHaveBeenCalled()
```

Use your test or story lifecycle to reset the shared server or worker between scenarios. The caller owns each spy and
its call history.

[Endpoint responses, request history, and reset behavior](docs/README.md)
