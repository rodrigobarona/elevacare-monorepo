import { ApiClientError } from "@eleva/api-client"

export function mapExpertApiError(
  err: unknown,
  fallback: string,
  codes?: Partial<{
    conflict: string
    forbidden: string
    notFound: string
    validation: string
  }>
): string {
  if (err instanceof ApiClientError) {
    if (err.status === 409 || err.body.error === "conflict") {
      return codes?.conflict ?? "conflict"
    }
    if (err.status === 403) {
      if (
        err.body.error === "forbidden" &&
        err.body.message?.toLowerCase().includes("calendar")
      ) {
        return "unauthorized-calendar"
      }
      return codes?.forbidden ?? "forbidden"
    }
    if (err.status === 404) {
      return codes?.notFound ?? "no-profile"
    }
    if (err.status === 422 || err.body.error === "validation") {
      return codes?.validation ?? "validation"
    }
  }
  return fallback
}
