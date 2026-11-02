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

To give each endpoint its own spy, keep a helper like this in your test setup. Each call creates a separate observer on
the same MSW server.

```ts
function spyOnPost(path: string, status: number) {
  const spy = jest.fn()
  createApiMock(server, spy).post(path, { status })
  return spy
}

const saveMessage = spyOnPost("/api/messages", 201)
const archiveMessage = spyOnPost("/api/archive", 204)
```

Use your test or story lifecycle to reset the shared server or worker between scenarios. The caller owns each spy and
its call history.

[Endpoint responses, request history, and reset behavior](docs/README.md)
