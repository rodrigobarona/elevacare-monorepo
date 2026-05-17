import { createPassthroughProxy } from "@eleva/observability/proxy"

export default createPassthroughProxy()

export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] }
