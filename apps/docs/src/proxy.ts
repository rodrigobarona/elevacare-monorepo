import { createPassthroughProxy, withHeaders } from "@eleva/observability/proxy"

export default withHeaders(createPassthroughProxy())

// Matcher must be inlined (Next.js static-analyzer requirement).
// Keep in sync with PASSTHROUGH_APP_MATCHER in @eleva/observability/proxy.
export const config = { matcher: ["/((?!api/|_next|_vercel|.*\\..*).*)"] }
