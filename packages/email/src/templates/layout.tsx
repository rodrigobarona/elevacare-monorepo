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
import { elevaTailwindConfig } from "../theme"
import { getEmailTranslations, type EmailLocale } from "../i18n"

interface LayoutProps {
  preview: string
  locale?: EmailLocale
  children: React.ReactNode
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
        {jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLd)
                .replace(/<\/script/gi, "<\\/script")
                .replace(/\u2028/g, "\\u2028")
                .replace(/\u2029/g, "\\u2029"),
            }}
          />
        )}
      </Head>
      <Preview>{preview}</Preview>
      <Tailwind config={elevaTailwindConfig}>
        <Body className="bg-canvas font-sans">
          <Container className="mx-auto max-w-[560px] px-4 py-10">
            <Section className="mb-6">
              <Text className="text-brand text-[20px] font-semibold tracking-tight">
                Eleva Care
              </Text>
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
