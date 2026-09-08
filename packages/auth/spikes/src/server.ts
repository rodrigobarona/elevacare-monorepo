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
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" })
      }
      res.end(JSON.stringify({ error: "handler_failed" }))
    })
  })

  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => {
      resolve({
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) closeReject(error)
              else closeResolve()
            })
          }),
      })
    })
  })
}
