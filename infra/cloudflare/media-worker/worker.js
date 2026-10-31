/**
 * Read-only delivery for the public R2 bucket. Serves GET/HEAD with Range and
 * conditional requests so <video> and HLS players can seek. Never lists keys.
 * Member uploads share this host with marketing media, so nothing served here
 * may run as a page: nosniff plus a sandboxing CSP.
 */
const BASE_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers":
    "content-length, content-range, accept-ranges, etag",
  "accept-ranges": "bytes",
  "content-security-policy": "default-src 'none'; sandbox",
  "cross-origin-resource-policy": "cross-origin",
  "x-content-type-options": "nosniff",
}
const DEFAULT_CACHE_CONTROL = "public, max-age=86400"

function withBase(headers = new Headers()) {
  for (const [name, value] of Object.entries(BASE_HEADERS)) {
    headers.set(name, value)
  }
  return headers
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: withBase(
          new Headers({
            "access-control-allow-methods": "GET, HEAD, OPTIONS",
            "access-control-allow-headers": "range, if-none-match",
            "access-control-max-age": "86400",
          })
        ),
      })
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, {
        status: 405,
        headers: withBase(new Headers({ allow: "GET, HEAD, OPTIONS" })),
      })
    }

    const url = new URL(request.url)
    const key = decodeURIComponent(url.pathname.slice(1))
    if (!key || key.endsWith("/")) {
      return new Response("Not found", { status: 404, headers: withBase() })
    }

    const isRange = request.headers.has("range")
    const cache = caches.default
    const cacheKey = new Request(url.origin + url.pathname, { method: "GET" })
    if (request.method === "GET" && !isRange) {
      const cached = await cache.match(cacheKey)
      if (cached) {
        const etag = cached.headers.get("etag")
        if (etag && request.headers.get("if-none-match") === etag) {
          return new Response(null, { status: 304, headers: cached.headers })
        }
        return cached
      }
    }

    if (request.method === "HEAD") {
      const head = await env.BUCKET.head(key)
      if (!head) {
        return new Response(null, { status: 404, headers: withBase() })
      }
      const headers = withBase()
      head.writeHttpMetadata(headers)
      headers.set("etag", head.httpEtag)
      headers.set("content-length", String(head.size))
      if (!headers.has("cache-control")) {
        headers.set("cache-control", DEFAULT_CACHE_CONTROL)
      }
      return new Response(null, { status: 200, headers })
    }

    const object = await env.BUCKET.get(key, {
      range: isRange ? request.headers : undefined,
      onlyIf: request.headers,
    })
    if (!object) {
      return new Response("Not found", { status: 404, headers: withBase() })
    }

    const headers = withBase()
    object.writeHttpMetadata(headers)
    headers.set("etag", object.httpEtag)
    if (!headers.has("cache-control")) {
      headers.set("cache-control", DEFAULT_CACHE_CONTROL)
    }
    if (!("body" in object)) {
      return new Response(null, { status: 304, headers })
    }

    if (isRange && object.range) {
      const { offset, length, suffix } = object.range
      const start = suffix !== undefined ? object.size - suffix : (offset ?? 0)
      const size = suffix ?? length ?? object.size - start
      headers.set(
        "content-range",
        `bytes ${start}-${start + size - 1}/${object.size}`
      )
      headers.set("content-length", String(size))
      return new Response(object.body, { status: 206, headers })
    }

    const response = new Response(object.body, { status: 200, headers })
    ctx.waitUntil(cache.put(cacheKey, response.clone()))
    return response
  },
}
