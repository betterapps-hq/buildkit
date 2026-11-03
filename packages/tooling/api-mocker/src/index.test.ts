import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vite-plus/test"
import { createApiMock, type OnRequest } from "./index.js"

const url = "https://example.test/items"
const server = setupServer(http.get(url, () => new HttpResponse(null, { status: 404 })))

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))

afterEach(() => server.resetHandlers())

afterAll(() => server.close())

it("serves a response sequence and repeats its final response", async () => {
  const api = createApiMock(server)
  const endpoint = api.get(url, [{ status: 503 }, { data: [], headers: { "x-scenario": "empty" } }])
  expect((await fetch(url)).status).toBe(503)
  expect(await (await fetch(url)).json()).toEqual([])
  expect((await fetch(url)).headers.get("x-scenario")).toBe("empty")
  expect(endpoint.hits).toBe(3)
  expect(endpoint.requests[0]).toEqual({ method: "GET", url, pathname: "/items" })
  expect(api.get(url)).toBe(endpoint)
  expect(endpoint.hits).toBe(0)
  expect((await fetch(url)).status).toBe(204)
  api.reset()
  expect(endpoint.hits).toBe(0)
  expect((await fetch(url)).status).toBe(404)
})

it("observes parsed bodies without consuming the request passed to a custom resolver", async () => {
  const onRequest = vi.fn<OnRequest>()
  const api = createApiMock(server, onRequest)
  api.post(url, async ({ request }) => HttpResponse.json(await request.json(), { status: 201 }))
  api.put(url)
  const body = { name: "Draft" }
  const response = await fetch(url, { method: "POST", body: JSON.stringify(body) })
  expect(response.status).toBe(201)
  expect(await response.json()).toEqual(body)
  await fetch(url, { method: "PUT", body: "plain text" })
  await fetch(url, { method: "PUT" })
  expect(onRequest.mock.calls).toEqual([[body], ["plain text"], [undefined]])
  api.reset()
  expect(onRequest).toHaveBeenCalledTimes(3)
})

it("lets consumers give each endpoint a separate spy on the same server", async () => {
  const save = vi.fn<OnRequest>()
  const remove = vi.fn<OnRequest>()
  createApiMock(server, save).patch(url)
  createApiMock(server, remove).delete(url)
  await fetch(url, { method: "PATCH", body: "change" })
  expect(save.mock.calls).toEqual([["change"]])
  expect(remove).not.toHaveBeenCalled()
  await fetch(url, { method: "DELETE" })
  expect(remove.mock.calls).toEqual([[undefined]])
  expect(save).toHaveBeenCalledTimes(1)
})

it("passes raw MSW handlers through to the target", async () => {
  createApiMock(server).handler(http.get(url, () => HttpResponse.text("custom")))
  expect(await (await fetch(url)).text()).toBe("custom")
})
