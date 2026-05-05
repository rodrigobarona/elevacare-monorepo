import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server"
import createIntl from "next-intl/middleware"
import { withAuth } from "@eleva/auth/proxy"
import { withHeaders } from "@eleva/observability/proxy"
import { routing } from "./i18n/routing"

const intl = createIntl(routing)

const handler = (req: NextRequest, _event?: NextFetchEvent) => {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next()
  }
  return intl(req)
}

export default withHeaders(withAuth(handler, { enforce: false }))

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
}
