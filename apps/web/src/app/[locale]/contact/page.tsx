import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { MarketingPage, type ContactChannel } from "@/components/marketing-page"
import { hreflangLanguages, localePath } from "@/lib/hreflang"

type Props = {
  params: Promise<{ locale: string }>
}

const CHANNELS = [
  { key: "support", icon: "headset", email: "support@eleva.care" },
  { key: "privacy", icon: "shield", email: "privacy@eleva.care" },
  { key: "legal", icon: "buildings", email: "legal@eleva.care" },
  { key: "security", icon: "shield", email: "security@eleva.care" },
] as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "contact" })
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: true, follow: true },
    alternates: {
      canonical: localePath(locale, "/contact"),
      languages: hreflangLanguages("/contact"),
    },
  }
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "contact" })

  const contacts: ContactChannel[] = CHANNELS.map((channel) => ({
    icon: channel.icon,
    email: channel.email,
    title: t(`channels.${channel.key}.title`),
    body: t(`channels.${channel.key}.body`),
  }))

  return (
    <MarketingPage
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      headingTestId="contact-heading"
      body={t("body")}
      contactsHeading={t("channelsHeading")}
      contacts={contacts}
      finalHeading={t("helpHeading")}
      finalBody={t("helpBody")}
      finalCta={{ href: "/docs", label: t("helpCta") }}
    />
  )
}
