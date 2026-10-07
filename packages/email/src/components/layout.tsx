import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email"
import type { ReactNode } from "react"
import { elevaTailwindConfig } from "../theme"
import { getEmailTranslations, type EmailLocale } from "../i18n"

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
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
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
        <Body className="bg-canvas m-0 font-sans">
          <Preview>{preview}</Preview>
          <Container className="mx-auto w-full max-w-[600px] px-[16px] py-[32px]">
            <Section className="border-stroke bg-bg overflow-hidden rounded-[12px] border border-solid">
              <Section className="bg-brand px-[28px] py-[24px]">
                <Text className="text-fg-inverted m-0 text-[20px] leading-[24px] font-semibold">
                  Eleva Care
                </Text>
                <Text className="text-fg-inverted m-0 mt-[4px] text-[12px] leading-[16px]">
                  {t.layout.tagline}
                </Text>
              </Section>
              <Section className="px-[28px] py-[32px]">{children}</Section>
              <Section className="border-stroke bg-canvas border-t border-none border-solid px-[28px] py-[24px]">
                <Text className="text-fg-3 m-0 text-[12px] leading-[18px]">
                  {t.layout.location}
                </Text>
                <Text className="text-fg-3 m-0 mt-[8px] text-[12px] leading-[18px]">
                  {t.layout.footer}
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
