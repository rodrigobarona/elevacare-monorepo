import { createServer } from "node:http"
import { toNodeHandler } from "better-auth/node"
import { auth } from "./auth.ts"

export function startSpikeServer(port: number): Promise<{
  close: () => Promise<void>
}> {
  const handler = toNodeHandler(auth)
  const server = createServer((req, res) => {
    if (req.url === "/ok" || req.url === "/auth/ok") {
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ ok: true, service: "better-auth-spike" }))
      return
    }
    handler(req, res).catch((error: unknown) => {
      console.error("spike handler error", error)
      if (res.writableEnded) return
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" })
      }
      res.end(JSON.stringify({ error: "handler_failed" }))
    })
  })

  return new Promise((resolve, reject) => {
    const onStartupError = (error: Error) => {
      reject(error)
    }
    server.once("error", onStartupError)
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onStartupError)
      server.on("error", (error) => {
        console.error("spike server error", error)
      })
      resolve({
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) closeReject(error)
              else closeResolve()
            })
            server.closeAllConnections()
          }),
      })
    })
  })
}
