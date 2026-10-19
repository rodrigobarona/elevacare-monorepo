import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@eleva/ui/lib/utils"
import { Eyebrow, Heading, Lead } from "@eleva/ui/components/typography"

const sectionVariants = cva("relative px-4 sm:px-6", {
  variants: {
    tone: {
      default: "bg-background text-foreground",
      muted: "bg-muted text-foreground",
      primary: "bg-teal-900 text-white",
    },
    spacing: {
      default: "py-20 sm:py-28",
      compact: "py-12 sm:py-16",
      none: "",
    },
  },
  defaultVariants: { tone: "default", spacing: "default" },
})

/** Full-width page band with consistent vertical rhythm. */
function Section({
  tone,
  spacing,
  className,
  ...props
}: React.ComponentProps<"section"> & VariantProps<typeof sectionVariants>) {
  return (
    <section
      data-slot="section"
      data-tone={tone ?? "default"}
      className={cn(sectionVariants({ tone, spacing }), className)}
      {...props}
    />
  )
}

function Container({
  size = "default",
  className,
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "narrow" | "wide" }) {
  return (
    <div
      data-slot="container"
      className={cn(
        "mx-auto w-full",
        size === "narrow" && "max-w-3xl",
        size === "default" && "max-w-6xl",
        size === "wide" && "max-w-7xl",
        className
      )}
      {...props}
    />
  )
}

/** Eyebrow + heading + lead, the opening of every marketing section. */
function SectionHeader({
  eyebrow,
  title,
  lead,
  align = "start",
  inverse = false,
  as = "h2",
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  lead?: React.ReactNode
  align?: "start" | "center"
  inverse?: boolean
  as?: "h1" | "h2" | "h3"
  className?: string
}) {
  return (
    <header
      data-slot="section-header"
      className={cn(
        "flex max-w-2xl flex-col gap-4",
        align === "center" && "mx-auto items-center text-center",
        className
      )}
    >
      {eyebrow ? (
        <Eyebrow tone={inverse ? "inverse" : "default"}>{eyebrow}</Eyebrow>
      ) : null}
      <Heading as={as} size="headline" tone={inverse ? "inverse" : "default"}>
        {title}
      </Heading>
      {lead ? (
        <Lead className={cn(inverse && "text-white/80")}>{lead}</Lead>
      ) : null}
    </header>
  )
}

export { Section, Container, SectionHeader, sectionVariants }
