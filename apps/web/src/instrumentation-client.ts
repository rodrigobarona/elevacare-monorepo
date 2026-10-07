import { initBotId } from "botid/client/core"
import {
  isSameOriginApiEnabled,
  SAME_ORIGIN_API_PREFIX,
} from "@/lib/same-origin-api"

// checkLevel must match the server-side checkBot() call on each route.
if (isSameOriginApiEnabled()) {
  initBotId({
    protect: ["bookings/reserve", "bookings/confirm", "payments/intent"].map(
      (route) => ({
        path: `${SAME_ORIGIN_API_PREFIX}/${route}`,
        method: "POST",
        advancedOptions: { checkLevel: "deepAnalysis" as const },
      })
    ),
  })
}
