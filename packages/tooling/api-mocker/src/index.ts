import { http, HttpResponse, type HttpResponseResolver, type RequestHandler } from "msw"

type HttpMethod = "get" | "post" | "put" | "patch" | "delete"

/** The handler registration methods shared by MSW workers and servers. */
export type HandlerTarget = {
  use(...handlers: RequestHandler[]): void
  resetHandlers(): void
}

/** Receives the parsed request body before the endpoint resolves. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- public API: callers decode the body themselves
export type OnRequest = (body: unknown) => void

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export type MockRequest = {
  method: string
  url: string
  pathname: string
}

export type MockEndpoint = {
  readonly hits: number
  readonly requests: readonly MockRequest[]
  clear(): void
}

class EndpointHistory implements MockEndpoint {
  private _requests: MockRequest[] = []

  private readonly onRequest: OnRequest | undefined

  constructor(onRequest?: OnRequest) {
    this.onRequest = onRequest
  }

  get hits(): number {
    return this._requests.length
  }

  get requests(): readonly MockRequest[] {
    return this._requests
  }

  clear() {
    this._requests.length = 0
  }

  /** @internal Called by the MSW resolver on each matching request. */
  async record(request: Request) {
    const url = new URL(request.url)
    this._requests.push({
      method: request.method.toUpperCase(),
      url: request.url,
      pathname: url.pathname + url.search
    })

    if (this.onRequest) {
      this.onRequest(await readBody(request))
    }
  }
}

/** The body as JSON, its text when it isn't JSON, or undefined when there is none. */
async function readBody(request: Request): Promise<JsonValue | undefined> {
  try {
    const text = await request.clone().text()

    if (!text) {
      return undefined
    }

    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch {
    return undefined
  }
}

export type MockOptions<T = unknown> = {
  status?: number
  data?: T
  headers?: Record<string, string>
}

function isResolver(value: MockOptions | HttpResponseResolver | undefined): value is HttpResponseResolver {
  return value instanceof Function
}

function resolveOptions(options: MockOptions): Response {
  const { status, data, headers = {} } = options

  if (data === null || data === undefined) {
    return new HttpResponse(null, { status: status ?? 204, headers })
  }

  return HttpResponse.json(data, { status: status ?? 200, headers })
}

function createHandler(
  method: HttpMethod,
  path: string,
  input: MockOptions | HttpResponseResolver | MockOptions[] | undefined,
  endpoint: EndpointHistory
): RequestHandler {
  if (Array.isArray(input)) {
    const sequence = [...input]

    const resolver: HttpResponseResolver = async (info) => {
      const next = sequence.length > 1 ? sequence.shift() : sequence[0]
      await endpoint.record(info.request)

      return resolveOptions(next ?? {})
    }

    return http[method](path, resolver)
  }

  const resolver: HttpResponseResolver = async (info) => {
    await endpoint.record(info.request)

    if (isResolver(input)) {
      return input(info)
    }

    return resolveOptions(input ?? {})
  }

  return http[method](path, resolver)
}

export type ApiMockMethod = {
  (path: string, resolver: HttpResponseResolver): MockEndpoint
  (path: string, sequence: MockOptions[]): MockEndpoint
  (path: string, options?: MockOptions): MockEndpoint
}

export type ApiMockInstance = {
  get: ApiMockMethod
  post: ApiMockMethod
  put: ApiMockMethod
  patch: ApiMockMethod
  delete: ApiMockMethod
  handler: (...handlers: RequestHandler[]) => void
  reset: () => void
}

/**
 * Register endpoints on an MSW worker or server. Pass an optional callback to
 * observe the parsed body of each request matched by a method on this instance.
 * `reset()` clears endpoint history and restores the target's initial handlers.
 * The caller owns the callback and its history.
 *
 * @example
 * createApiMock(worker).get("/api/welcome", { data: { message: "Hi" } })
 */
export function createApiMock(target: HandlerTarget, onRequest?: OnRequest): ApiMockInstance {
  const endpointRegistry = new Map<string, EndpointHistory>()

  function escapePath(path: string): string {
    return path.replace(/(?<!\\)\(/g, "\\(").replace(/(?<!\\)\)/g, "\\)")
  }

  function mock(method: HttpMethod): ApiMockMethod {
    return function (path: string, input?: MockOptions | HttpResponseResolver | MockOptions[]): MockEndpoint {
      const escapedPath = escapePath(path)
      const key = `${method}:${path}`
      const endpoint = endpointRegistry.get(key) ?? new EndpointHistory(onRequest)
      endpoint.clear()
      endpointRegistry.set(key, endpoint)
      target.use(createHandler(method, escapedPath, input, endpoint))

      return endpoint
    }
  }

  return {
    get: mock("get"),
    post: mock("post"),
    put: mock("put"),
    patch: mock("patch"),
    delete: mock("delete"),
    handler(...handlers: RequestHandler[]) {
      target.use(...handlers)
    },
    reset() {
      endpointRegistry.forEach((e) => e.clear())
      endpointRegistry.clear()
      target.resetHandlers()
    }
  }
}
