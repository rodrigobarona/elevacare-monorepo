import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email"
import type { ReactNode } from "react"
import { elevaTailwindConfig } from "../theme"
import { getEmailTranslations, type EmailLocale } from "../i18n"

/** Served by apps/web from `public/brand/`; email clients need an absolute PNG. */
const LOGO_URL = "https://eleva.care/brand/eleva-logo-color.png"

interface LayoutProps {
  preview: string
  locale?: EmailLocale
  children: ReactNode
  jsonLd?: Record<string, unknown>
}

export function EmailLayout({
  preview,
  locale = "en",
  children,
  jsonLd,
}: LayoutProps) {
  const t = getEmailTranslations(locale)

  return (
    <Html lang={locale}>
      <Head>
        {jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLd)
                .replace(/<\/script/gi, "<\\/script")
                .replace(/\u2028/g, "\\u2028")
                .replace(/\u2029/g, "\\u2029"),
            }}
          />
        ) : null}
      </Head>
      <Tailwind config={elevaTailwindConfig}>
        <Body className="bg-canvas font-sans">
          <Preview>{preview}</Preview>
          <Container className="mx-auto max-w-[560px] px-4 py-10">
            <Section className="mb-6">
              <Img src={LOGO_URL} alt="Eleva Care" width="141" height="28" />
            </Section>
            {children}
            <Section className="border-stroke mt-10 border-t pt-6">
              <Text className="text-fg-3 text-[12px] leading-5">
                Eleva Care · Lisbon, Portugal
              </Text>
              <Text className="text-fg-3 text-[12px] leading-5">
                {t.layout.footer}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
