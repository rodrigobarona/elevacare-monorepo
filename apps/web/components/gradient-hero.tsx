import Image from "next/image"

import { cn } from "@eleva/ui/lib/utils"
import { Eyebrow } from "@/components/eyebrow"
import { SectionHeading } from "@/components/section-heading"

interface GradientHeroProps {
  eyebrow?: string
  title: React.ReactNode
  subtitle?: string
  actions?: React.ReactNode
  trust?: React.ReactNode
  imageSrc?: string
  imageAlt?: string
  variant?: "split" | "solo"
}

export function GradientHero({
  eyebrow,
  title,
  subtitle,
  actions,
  trust,
  imageSrc,
  imageAlt = "",
  variant = "solo",
}: GradientHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-eleva-secondary-light/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className={cn(
            "py-20 lg:py-28",
            variant === "split" && "grid items-center gap-12 lg:grid-cols-2"
          )}
        >
          <div
            className={cn("max-w-2xl", variant === "split" && "lg:max-w-xl")}
          >
            {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
            <SectionHeading
              as="h1"
              className="text-4xl sm:text-5xl lg:text-6xl"
            >
              {title}
            </SectionHeading>
            {subtitle && (
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            )}
            {actions && (
              <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
            )}
            {trust && <div className="mt-10">{trust}</div>}
          </div>

          {variant === "split" && imageSrc && (
            <div className="relative hidden aspect-[4/3] overflow-hidden rounded-3xl lg:block">
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                className="object-cover"
                priority
                sizes="(min-width: 1024px) 50vw, 0vw"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
