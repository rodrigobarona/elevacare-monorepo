import { ConsentGate } from "@eleva/consent"
import { Container, Section } from "@eleva/ui/blocks/section"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Eyebrow, Heading, Lead } from "@eleva/ui/components/typography"
import { Link } from "@/i18n/navigation"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export function PillarPage({
  eyebrow,
  heading,
  body,
  primaryCta,
  secondaryLinks,
  embed,
}: {
  eyebrow: string
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
            <Eyebrow>{eyebrow}</Eyebrow>
            <Heading className="mt-3">{heading}</Heading>
            <Lead className="mt-4">{body}</Lead>
            {primaryCta ? (
              primaryCta.external ? (
                <a
                  href={primaryCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ className: "mt-8" })}
                >
                  {primaryCta.label}
                </a>
              ) : (
                <Link
                  href={primaryCta.href}
                  className={buttonVariants({ className: "mt-8" })}
                >
                  {primaryCta.label}
                </Link>
              )
            ) : null}
            {secondaryLinks?.length ? (
              <ul className="mt-6 flex flex-wrap gap-4 text-sm">
                {secondaryLinks.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-primary underline-offset-2 hover:underline"
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
                <div className="mt-10 overflow-hidden rounded-xl border bg-muted/30">
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
