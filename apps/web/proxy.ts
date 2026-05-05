import createIntl from "next-intl/middleware"
import { withHeaders } from "@eleva/observability/proxy"
import { routing } from "./src/i18n/routing"

const intl = createIntl(routing)

// @ts-expect-error next-intl pins next@16.1 while project uses 16.2; runtime-compatible
export default withHeaders(intl)

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
