import { redirect } from "next/navigation"
import { sanitizeReturnTo } from "@eleva/auth/return-to"

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const params = await searchParams
  redirect(sanitizeReturnTo(params.returnTo) ?? "/dashboard")
}
