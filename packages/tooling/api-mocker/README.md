# @buildkitgg/api-mocker

API Mocker streamlines MSW setup for unit tests and Storybook. Describe what an endpoint returns and let the real client
make the request. A test can check how the client handles an empty inbox, and a story can show how that same inbox
looks, using one shared mock.

MSW owns interception and the server or worker lifecycle. `createApiMock(target)` registers handlers on that target and
returns a handle for each endpoint you mock. Add a spy when a request itself matters, such as saving a message once or
retrying a failed read.

## Contents

- [Share an endpoint between tests and stories](#share-an-endpoint-between-tests-and-stories)
- [Mock an endpoint in a unit test](#mock-an-endpoint-in-a-unit-test)
- [Mock a connected component in Storybook](#mock-a-connected-component-in-storybook)
- [Return different responses on successive calls](#return-different-responses-on-successive-calls)
- [Check call counts and request history](#check-call-counts-and-request-history)
- [Spy on request bodies](#spy-on-request-bodies)
- [Create a spy per endpoint](#create-a-spy-per-endpoint)
- [Mock a workflow that requires requests in order](#mock-a-workflow-that-requires-requests-in-order)
- [Clear history and reset handlers](#clear-history-and-reset-handlers)

## Share an endpoint between tests and stories

Supply MSW 3 as a peer dependency. The examples use a message client configured to call
`https://api.example.test/messages`. Put its mock beside the feature's shared test fixtures so both environments can
import it.

```ts
// message-mocks.ts
import type { ApiMockInstance } from "@buildkitgg/api-mocker"

export const messagesUrl = "https://api.example.test/messages"

export function mockInbox(api: ApiMockInstance, messages: { id: string; text: string }[]) {
  return api.get(messagesUrl, { data: messages })
}
```

Use `get`, `post`, `put`, `patch`, or `delete` with an MSW path. A static response accepts `data`, `status`, and
`headers`. Data produces a JSON response with status 200 by default. Omitting data or passing `null` produces an empty
response with status 204 by default. An explicit status overrides either default.

## Mock an endpoint in a unit test

Create the mock against your MSW server. If the test suite already starts a server, use that instance. Here, `loadInbox`
is the application's client function.

```ts
import { createApiMock } from "@buildkitgg/api-mocker"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, expect, it } from "vitest"
import { loadInbox } from "./message-client"
import { mockInbox } from "./message-mocks"

const server = setupServer()
const api = createApiMock(server)

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
afterEach(() => api.reset())
afterAll(() => server.close())

it("loads the inbox", async () => {
  const messages = [{ id: "m1", text: "Lunch at noon?" }]
  mockInbox(api, messages)

  expect(await loadInbox()).toEqual(messages)
})
```

## Mock a connected component in Storybook

With the MSW Storybook addon configured to supply `msw` in the story context, register the same mock in `beforeEach`.
Each story renders the app's `Inbox` component with its own response.

```ts
import { createApiMock } from "@buildkitgg/api-mocker"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Inbox } from "./Inbox"
import { mockInbox } from "./message-mocks"

const meta = { component: Inbox } satisfies Meta<typeof Inbox>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  beforeEach({ msw }) {
    mockInbox(createApiMock(msw), [])
  }
}

export const WithMessages: Story = {
  beforeEach({ msw }) {
    mockInbox(createApiMock(msw), [{ id: "m1", text: "Lunch at noon?" }])
  }
}
```

## Return different responses on successive calls

Pass an array to model a temporary failure. In this test the client should retry once after a 503. Each matching request
takes the next response in the array. Further requests repeat the final response. An empty array serves an empty 204
response.

```ts
const inbox = api.get(messagesUrl, [{ status: 503 }, { data: [{ id: "m1", text: "Back online" }] }])

expect(await loadInboxWithRetry()).toEqual([{ id: "m1", text: "Back online" }])
expect(inbox.hits).toBe(2)
```

## Check call counts and request history

Each endpoint handle exposes `hits` and an ordered `requests` list. The list records the HTTP method, full URL, and
`pathname`, which includes the query string. For example, a pagination test can catch a client fetching the first page
twice even when both responses contain the same data.

```ts
const inbox = mockInbox(api, [])

await loadInboxPage(1)
await loadInboxPage(2)

expect(inbox.hits).toBe(2)
expect(inbox.requests.map((request) => request.pathname)).toEqual(["/messages?page=1", "/messages?page=2"])
```

## Spy on request bodies

Pass `onRequest` as the second argument to the factory. It receives the parsed body for every matching endpoint
registered through that instance. JSON is parsed, other text is passed verbatim, and an empty or unreadable body yields
`undefined`. The observer reads a clone, so a resolver can still read the original request. Omitting the observer skips
body parsing.

```ts
const onRequest = vi.fn() // In Jest, use jest.fn().
const writes = createApiMock(server, onRequest)
writes.post(messagesUrl, { status: 201 })

await sendMessage({ text: "Hello" })

expect(onRequest).toHaveBeenCalledWith({ text: "Hello" })
```

## Create a spy per endpoint

Keep this factory in your test utilities when several endpoints share a server and each needs its own assertions. It
accepts static responses and creates a fresh spy at registration. For Jest, use `jest.fn<OnRequest>()` in place of
`vi.fn<OnRequest>()`.

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
const writes = createApiSpy(server)
const save = writes.post(messagesUrl, { status: 201 })
const archive = writes.post(`${messagesUrl}/archive`, { status: 204 })

await sendMessage({ text: "Hello" })

expect(save.spy).toHaveBeenCalledWith({ text: "Hello" })
expect(archive.spy).not.toHaveBeenCalled()
```

## Mock a workflow that requires requests in order

A response array belongs to one endpoint. When a workflow spans endpoints, use MSW resolvers that share state for that
test. Here the client must create a draft, read its ID from the response, and then publish it. An early publish gets
a 409. The shared list records the order in which the resolvers ran.

```ts
import { HttpResponse } from "msw"

const calls: string[] = []
let draftExists = false

api.post(messagesUrl, () => {
  calls.push("create")
  draftExists = true
  return HttpResponse.json({ id: "m1" }, { status: 201 })
})

api.post(`${messagesUrl}/m1/publish`, () => {
  calls.push("publish")
  return new HttpResponse(null, { status: draftExists ? 204 : 409 })
})

await createAndPublishMessage({ text: "Hello" })

expect(calls).toEqual(["create", "publish"])
```

Use `api.handler(...handlers)` to register existing MSW handlers directly. Those handlers run outside the factory's
observer and endpoint history.

## Clear history and reset handlers

| Operation                                                    | Effect                                                                                                                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `endpoint.clear()`                                           | Clears that handle's calls and hit count. Its response sequence continues from its current position.                                                                                         |
| Register the same method and path again on the same instance | Reuses the handle, clears its history, and installs the new response or sequence.                                                                                                            |
| `api.reset()`                                                | Clears that instance's endpoint history and calls `target.resetHandlers()`. This removes runtime overrides from every factory sharing the target and restores the target's initial handlers. |
| `spy.mockClear()`                                            | Clears a caller-owned Vitest or Jest spy. Its history is independent of endpoint resets.                                                                                                     |
