import { createServer, type Server } from "node:net"
import { routeStore } from "./state.js"

/** The TCP port a server listens on. A server on a pipe, or one that isn't listening, has none. */
export function listeningPort(server: Pick<Server, "address">) {
  const address = server.address()

  return address instanceof Object ? address.port : undefined
}

/** Hold an OS-assigned port until its route is registered, then hand it to the server. */
export async function reservePort() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const server = createServer()
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve)
    })
    const port = listeningPort(server)
    let released: Promise<void> | undefined

    const release = () =>
      (released ??= new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }))

    if (port === undefined) {
      await release()
      throw new Error("Could not reserve a local server port")
    }

    // Another launcher may have registered its route and released its socket,
    // but its framework has not bound the port yet.
    try {
      if (
        routeStore()
          .loadRoutes()
          .some((route) => route.port === port)
      ) {
        await release()
        continue
      }
    } catch (error) {
      await release()
      throw error
    }

    return { port, release }
  }

  throw new Error("Could not reserve an unused local server port. Try again.")
}
