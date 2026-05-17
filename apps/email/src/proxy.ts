import {
  createPassthroughProxy,
  PASSTHROUGH_APP_MATCHER,
} from "@eleva/observability/proxy"

export default createPassthroughProxy()

export const config = { matcher: PASSTHROUGH_APP_MATCHER }
