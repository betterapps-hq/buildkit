# Endpoint behavior

- `get`, `post`, `put`, `patch`, and `delete` accept an MSW path and optional response. Pass `{ status, headers, data }`
  to return JSON. Without data, the default response is empty with status 204.
- Pass an array to serve its entries in order. Subsequent calls repeat the last response. An empty array returns an
  empty 204 response.
- Pass an MSW resolver for dynamic responses. When an observer is provided, it reads a cloned request. JSON is parsed,
  other text is returned verbatim, and an empty or unreadable body yields `undefined`.
- Each endpoint handle exposes `hits`, `requests` (method, URL, and path including query), and `clear()`. Re-registering
  the same method and path through the same instance clears its history and installs the new response.
- `handler(...handlers)` registers raw MSW handlers directly. These do not invoke the factory observer.
- `reset()` clears the instance's endpoint history and calls the target's `resetHandlers()`. All runtime overrides on
  that target are removed, including overrides from other instances sharing it. Initial MSW handlers remain registered.

[Storybook and test examples](../README.md)
