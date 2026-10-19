import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@eleva/ui/lib/utils"

const headingVariants = cva("font-display text-foreground", {
  variants: {
    size: {
      display: "text-display font-normal",
      headline: "text-headline font-normal",
      title: "text-title font-medium",
      subtitle: "text-xl leading-snug font-medium tracking-tight",
    },
    tone: {
      default: "",
      primary: "text-primary",
      inverse: "text-white",
    },
  },
  defaultVariants: { size: "headline", tone: "default" },
})

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "p"

function Heading({
  as: Tag = "h2",
  size,
  tone,
  className,
  ...props
}: React.ComponentProps<"h2"> &
  VariantProps<typeof headingVariants> & { as?: HeadingLevel }) {
  return (
    <Tag
      data-slot="heading"
      className={cn(headingVariants({ size, tone }), className)}
      {...props}
    />
  )
}

/** Italic serif accent inside a heading, e.g. "Experts, <Accent>on-demand.</Accent>" */
function Accent({ className, ...props }: React.ComponentProps<"em">) {
  return (
    <em
      data-slot="heading-accent"
      className={cn("font-display italic", className)}
      {...props}
    />
  )
}

function Eyebrow({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"p"> & { tone?: "default" | "accent" | "inverse" }) {
  return (
    <p
      data-slot="eyebrow"
      className={cn(
        "eyebrow",
        tone === "default" && "text-primary",
        tone === "accent" && "text-coral-700 dark:text-coral-300",
        tone === "inverse" && "text-white/80",
        className
      )}
      {...props}
    />
  )
}

function Lead({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="lead"
      className={cn("text-lead text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Accent, Eyebrow, Heading, headingVariants, Lead }
