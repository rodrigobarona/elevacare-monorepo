import { setRequestLocale } from "next-intl/server"
import { MarketingHome } from "@/components/marketing-home"

type Props = {
  params: Promise<{ locale: string }>
}

/**
 * Logged-in users can always reach the marketing page at /home
 * (the root / redirects authenticated users to their dashboard).
 */
export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return <MarketingHome />
}
