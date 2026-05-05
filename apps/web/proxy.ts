import createIntl from "next-intl/middleware"
import { withHeaders } from "@eleva/observability/proxy"
import { routing } from "./i18n/routing"

const intl = createIntl(routing)

export default withHeaders(intl)

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
