import createIntl from "next-intl/middleware"
import { withHeaders } from "@eleva/observability/proxy"
import { routing } from "./i18n/routing"

// Gateway proxy (apps/web): next-intl handles locale detection + prefix
// rewrites; the app-zone's internal proxy handles auth gating. The
// gateway itself stays public for marketing + /[username] routes.
const intl = createIntl(routing)

export default withHeaders(intl)

export const config = {
  // Match everything except API routes, Next assets, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
