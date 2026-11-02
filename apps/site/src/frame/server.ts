import type { Invoice } from "../examples/configuration/InvoiceList"

// The API the examples call, answered inside the frame. Requests to /api never leave the page: each answers after a
// short delay, and going offline makes them fail the way fetch fails without a network. The frame loads this before
// any example, since some fetch as soon as their module runs.

export const INVOICES: Invoice[] = [
  { id: "inv-3", issuedAt: "2026-11-01T12:00:00", total: 1240 },
  { id: "inv-2", issuedAt: "2026-10-28T12:00:00", total: 860 },
  { id: "inv-1", issuedAt: "2026-10-21T12:00:00", total: 2015.5 }
]

const LATENCY = 450

let offline = false

export function setOffline(value: boolean) {
  offline = value
}

type Route = {
  method: string
  path: RegExp
  respond(request: Request, params: string[]): unknown
}

const routes: Route[] = [
  {
    method: "PATCH",
    path: /^\/api\/projects\/([^/]+)$/,
    async respond(request, [id]) {
      return { id, ...(await request.json()) }
    }
  },
  // The free plan turns CSV export on, so that setting shows as coming from the provider
  { method: "GET", path: /^\/api\/settings$/, respond: () => ({ csvExport: true }) }
]

function wait(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(resolve, LATENCY)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
}

const network = window.fetch.bind(window)

window.fetch = async (input, init) => {
  const request = new Request(input, init)
  const url = new URL(request.url)
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
    return network(input, init)
  }
  await wait(request.signal)
  if (offline) {
    throw new TypeError("Failed to fetch")
  }
  for (const route of routes) {
    const match = route.method === request.method ? route.path.exec(url.pathname) : null
    if (match) {
      return Response.json(await route.respond(request, match.slice(1)))
    }
  }
  return new Response(null, { status: 404 })
}

/** Answers a download link to `/api/invoices.csv` with the invoices themselves. */
document.addEventListener(
  "click",
  (event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[download]") : null
    if (!link || new URL(link.href).pathname !== "/api/invoices.csv") {
      return
    }
    event.preventDefault()
    const rows = INVOICES.map((invoice) => [invoice.id, invoice.issuedAt.slice(0, 10), invoice.total].join(","))
    const file = new Blob([["id,issued,total", ...rows].join("\n")], { type: "text/csv" })
    const save = document.createElement("a")
    save.href = URL.createObjectURL(file)
    save.download = "invoices.csv"
    save.click()
    URL.revokeObjectURL(save.href)
  },
  true
)
