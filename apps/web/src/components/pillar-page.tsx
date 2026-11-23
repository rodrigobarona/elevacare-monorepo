import { ConsentGate } from "@eleva/consent"
import { Container, Section } from "@eleva/ui/blocks/section"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Heading, Lead } from "@eleva/ui/components/typography"
import { Link } from "@/i18n/navigation"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export function PillarPage({
  heading,
  body,
  primaryCta,
  secondaryLinks,
  embed,
}: {
  heading: string
  body: string
  primaryCta?: { href: string; label: string; external?: boolean }
  secondaryLinks?: { href: string; label: string; external?: boolean }[]
  embed?: { title: string; src: string }
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Section>
          <Container className="max-w-3xl">
            <Heading as="h1" size="display" className="text-balance">
              {heading}
            </Heading>
            <Lead className="mt-4">{body}</Lead>
            {primaryCta ? (
              primaryCta.external ? (
                <a
                  href={primaryCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: "xl", className: "mt-8" })}
                >
                  {primaryCta.label}
                </a>
              ) : (
                <Link
                  href={primaryCta.href}
                  className={buttonVariants({ size: "xl", className: "mt-8" })}
                >
                  {primaryCta.label}
                </Link>
              )
            ) : null}
            {secondaryLinks?.length ? (
              <ul className="mt-5 flex flex-wrap gap-x-6 text-base">
                {secondaryLinks.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center font-medium text-primary underline decoration-[1.5px] underline-offset-[5px]"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="inline-flex min-h-11 items-center font-medium text-primary underline decoration-[1.5px] underline-offset-[5px]"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            {embed?.src ? (
              <ConsentGate category="marketing">
                <div className="mt-10 overflow-hidden rounded-3xl border bg-card">
                  <p className="border-b px-4 py-2 text-sm text-muted-foreground">
                    {embed.title}
                  </p>
                  <iframe
                    title={embed.title}
                    src={embed.src}
                    className="min-h-[420px] w-full bg-background"
                  />
                </div>
              </ConsentGate>
            ) : null}
          </Container>
        </Section>
      </main>
      <SiteFooter />
    </div>
  )
}
