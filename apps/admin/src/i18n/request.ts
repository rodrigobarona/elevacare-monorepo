import { createRequestConfig } from "@eleva/dashboard/request-config"

export default createRequestConfig((locale) =>
  import(`../../messages/${locale}.json`, { with: { type: "json" } }).then(
    (m) => m.default as Record<string, unknown>
  )
)
