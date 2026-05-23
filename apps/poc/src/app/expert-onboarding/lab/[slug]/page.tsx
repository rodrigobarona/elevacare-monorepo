import { redirect } from "next/navigation"
import { LAB_REDIRECTS } from "@/lib/poc-catalog"

export default async function LabRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const dest = LAB_REDIRECTS[slug]
  if (dest) redirect(dest)
  redirect("/expert-onboarding")
}
