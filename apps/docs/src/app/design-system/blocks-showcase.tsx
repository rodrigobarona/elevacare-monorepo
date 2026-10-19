import {
  ArrowRightIcon,
  SealCheckIcon,
  TagIcon,
  TranslateIcon,
  VideoCameraIcon,
} from "@eleva/icons"
import { ElevaImage } from "@eleva/media/image"
import { ElevaVideo } from "@eleva/media/video"
import { CtaBand } from "@eleva/ui/blocks/cta-band"
import { ExpertCard, ExpertCardInitials } from "@eleva/ui/blocks/expert-card"
import { MediaCard } from "@eleva/ui/blocks/media-card"
import { MediaHero, MediaHeroActions } from "@eleva/ui/blocks/media-hero"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { Steps } from "@eleva/ui/blocks/steps"
import { TrustStrip } from "@eleva/ui/blocks/trust-strip"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Accent, Eyebrow, Heading, Lead } from "@eleva/ui/components/typography"

const CARDS = [
  { slug: "service-pregnancy", title: "Pregnancy & postpartum" },
  { slug: "service-pelvic-health", title: "Pelvic health" },
  { slug: "service-every-stage", title: "Every life stage" },
] as const

const SAMPLE_EXPERTS = [
  {
    slug: "expert-at-desk",
    initials: "SE",
    name: "Sample Expert, PT",
    headline: "Pelvic health and postpartum recovery, online and in Lisbon.",
    badge: "Top Expert",
    tags: ["Physiotherapy", "Pelvic health"],
    meta: "Portuguese · English",
    price: "From €60",
  },
  {
    slug: null,
    initials: "NE",
    name: "No-photo Expert",
    headline: "Cards fall back to an initials tile when there is no portrait.",
    badge: undefined,
    tags: ["Nutrition"],
    meta: "Spanish",
    price: "Price on request",
  },
] as const

function BlockFrame({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) {
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="font-mono text-xs text-muted-foreground">
        {name}
      </figcaption>
      <div className="overflow-hidden rounded-2xl border bg-background">
        {children}
      </div>
    </figure>
  )
}

/**
 * Marketing organisms from `@eleva/ui/blocks`, composed with `@eleva/media`
 * slots exactly as `apps/web` uses them.
 */
export function BlocksShowcase() {
  return (
    <div className="flex flex-col gap-12">
      <BlockFrame name="MediaHero + MediaHeroActions">
        <MediaHero
          className="min-h-[28rem] sm:min-h-[30rem]"
          media={<ElevaVideo slug="hero-intro" locale="en" />}
        >
          <div className="flex max-w-2xl flex-col gap-4">
            <Eyebrow tone="inverse">Women&apos;s health</Eyebrow>
            <Heading as="p" size="headline" tone="inverse">
              Expert care, <Accent>close to you.</Accent>
            </Heading>
            <Lead className="text-white/85">
              Book trusted specialists online or in person.
            </Lead>
          </div>
          <MediaHeroActions>
            <a
              href="#blocks"
              className={buttonVariants({ variant: "inverse", size: "lg" })}
            >
              Find an expert
              <ArrowRightIcon data-icon="inline-end" />
            </a>
          </MediaHeroActions>
        </MediaHero>
      </BlockFrame>

      <BlockFrame name="Section spacing=compact + TrustStrip">
        <Section spacing="compact">
          <Container>
            <TrustStrip
              items={[
                {
                  icon: <SealCheckIcon />,
                  title: "Independent experts",
                  description: "Licensed professionals.",
                },
                {
                  icon: <VideoCameraIcon />,
                  title: "Online or in person",
                  description: "You choose how to meet.",
                },
                {
                  icon: <TranslateIcon />,
                  title: "Your language",
                  description: "English, Portuguese, Spanish.",
                },
                {
                  icon: <TagIcon />,
                  title: "Clear prices",
                  description: "Shown before you book.",
                },
              ]}
            />
          </Container>
        </Section>
      </BlockFrame>

      <BlockFrame name="SectionHeader + MediaCard">
        <Section spacing="compact">
          <Container className="flex flex-col gap-10">
            <SectionHeader
              eyebrow="Services"
              title={
                <>
                  Care for <Accent>every stage</Accent>
                </>
              }
              lead="Cards take an image slot, a title and an optional description."
            />
            <div className="grid gap-6 sm:grid-cols-3">
              {CARDS.map((card) => (
                <MediaCard
                  key={card.slug}
                  href="#blocks"
                  media={
                    <ElevaImage
                      slug={card.slug}
                      locale="en"
                      fill
                      sizes="(min-width: 640px) 33vw, 100vw"
                    />
                  }
                  title={card.title}
                  description="Short, plain description of the service."
                  actionLabel="See experts"
                />
              ))}
            </div>
          </Container>
        </Section>
      </BlockFrame>

      <BlockFrame name="ExpertCard">
        <Section spacing="compact">
          <Container>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {SAMPLE_EXPERTS.map((expert) => (
                <li key={expert.name}>
                  <ExpertCard
                    href="#blocks"
                    media={
                      expert.slug ? (
                        <ElevaImage
                          slug={expert.slug}
                          locale="en"
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        />
                      ) : (
                        <ExpertCardInitials
                          initials={expert.initials}
                          className="bg-teal-700"
                        />
                      )
                    }
                    name={expert.name}
                    headline={expert.headline}
                    badge={expert.badge}
                    tags={expert.tags}
                    meta={expert.meta}
                    price={expert.price}
                  />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      </BlockFrame>

      <BlockFrame name="Section tone=muted + Steps">
        <Section tone="muted" spacing="compact">
          <Container>
            <Steps
              items={[
                {
                  title: "Find",
                  description: "Browse experts by need.",
                },
                { title: "Book", description: "Pick a time and pay." },
                { title: "Meet", description: "Join from your email link." },
              ]}
            />
          </Container>
        </Section>
      </BlockFrame>

      <BlockFrame name="CtaBand (gradient) and CtaBand with media">
        <Section spacing="compact">
          <Container className="flex flex-col gap-8">
            <CtaBand
              title="Ready when you are"
              lead="One clear action per band."
              actions={
                <a
                  href="#blocks"
                  className={buttonVariants({ variant: "inverse", size: "lg" })}
                >
                  Get started
                </a>
              }
            />
            <CtaBand
              eyebrow="For experts"
              title="Grow your practice"
              lead="Split layout when a photo helps."
              media={
                <ElevaImage
                  slug="expert-at-desk"
                  locale="en"
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              }
              actions={
                <a
                  href="#blocks"
                  className={buttonVariants({ variant: "inverse", size: "lg" })}
                >
                  Become an expert
                </a>
              }
            />
          </Container>
        </Section>
      </BlockFrame>
    </div>
  )
}
