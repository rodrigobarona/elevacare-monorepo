import { setRequestLocale } from "next-intl/server"
import { MarketingHome } from "@/components/marketing-home"

type Props = {
  params: Promise<{ locale: string }>
}

/**
 * Stable marketing URL for logged-in users arriving from product apps.
 * Locale roots (/pt, /) also render the homepage; bare / still redirects
 * to the product on full-page entry only.
 */
export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return <MarketingHome />
}
