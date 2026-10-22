import type { ComponentProps, ReactNode } from "react"
import type { MDXComponents } from "mdx/types"
import Link from "next/link"
import {
  ArrowRightIcon,
  CheckCircleIcon,
  InfoIcon,
  SparkleIcon,
  WarningIcon,
  WarningOctagonIcon,
} from "@eleva/icons"
import { Alert, AlertDescription, AlertTitle } from "@eleva/ui/components/alert"
import { cn } from "@eleva/ui/lib/utils"
import { AccordionEntry, Accordions, Tab, Tabs } from "./mdx-interactive"

const CALLOUT_TYPES = {
  info: { Icon: InfoIcon, tone: "border-primary/25 bg-primary/5" },
  tip: { Icon: SparkleIcon, tone: "border-primary/25 bg-primary/5" },
  success: { Icon: CheckCircleIcon, tone: "border-success/30 bg-success/5" },
  warn: { Icon: WarningIcon, tone: "border-warning/30 bg-warning-subtle" },
  error: {
    Icon: WarningOctagonIcon,
    tone: "border-destructive/30 bg-destructive/5",
  },
} as const

type CalloutType = keyof typeof CALLOUT_TYPES | "warning" | "idea"

function resolveCalloutType(type: CalloutType): keyof typeof CALLOUT_TYPES {
  switch (type) {
    case "warning":
      return "warn"
    case "idea":
      return "tip"
    default:
      return type
  }
}

export function Callout({
  type = "info",
  title,
  children,
}: {
  type?: CalloutType
  title?: ReactNode
  children: ReactNode
}) {
  const { Icon, tone } =
    CALLOUT_TYPES[resolveCalloutType(type)] ?? CALLOUT_TYPES.info
  return (
    <Alert className={cn("my-6 text-base", tone)}>
      <Icon aria-hidden />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription className="text-base text-foreground/85 [&_p:not(:last-child)]:mb-2">
        {children}
      </AlertDescription>
    </Alert>
  )
}

export function Cards({ children }: { children: ReactNode }) {
  return <div className="my-6 grid gap-4 sm:grid-cols-2">{children}</div>
}

export function Card({
  title,
  href,
  children,
}: {
  title: ReactNode
  href?: string
  children?: ReactNode
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-3 font-medium text-foreground">
        {title}
        {href ? (
          <ArrowRightIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        ) : null}
      </span>
      {children ? (
        <span className="mt-1 block text-sm text-muted-foreground [&_p]:m-0">
          {children}
        </span>
      ) : null}
    </>
  )
  const className =
    "group block rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40"
  if (!href) {
    return <div className={className}>{body}</div>
  }
  return (
    <ContentLink href={href} className={className}>
      {body}
    </ContentLink>
  )
}

export function Steps({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 ml-3 border-l pl-8 [counter-reset:step]">
      {children}
    </div>
  )
}

export function Step({ children }: { children: ReactNode }) {
  return (
    <div className="relative pb-6 [counter-increment:step] before:absolute before:top-0 before:-left-[2.85rem] before:flex before:size-7 before:items-center before:justify-center before:rounded-full before:border before:bg-background before:font-mono before:text-xs before:text-primary before:content-[counter(step)] last:pb-0 [&>h3]:mt-0 [&>h4]:mt-0">
      {children}
    </div>
  )
}

/** Numbered reference list for evidence pages (`<References>` + `<li>`). */
export function References({
  title,
  children,
}: {
  title?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-12 border-t pt-8">
      {title ? (
        <h2 className="font-display text-title font-medium">{title}</h2>
      ) : null}
      <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-muted-foreground [&_a]:break-words">
        {children}
      </ol>
    </section>
  )
}

function isExternal(href: string): boolean {
  return /^(https?:)?\/\//.test(href) || href.startsWith("mailto:")
}

function ContentLink({ href = "", className, ...props }: ComponentProps<"a">) {
  if (isExternal(href)) {
    const isWeb = !href.startsWith("mailto:")
    return (
      <a
        href={href}
        className={className}
        {...(isWeb ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...props}
      />
    )
  }
  if (href.startsWith("#")) {
    return <a href={href} className={className} {...props} />
  }
  return <Link href={href} className={className} {...props} />
}

const proseLink =
  "font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"

/** Typographic defaults plus the shared MDX blocks. */
export function getMdxComponents(overrides?: MDXComponents): MDXComponents {
  return {
    // Page layouts already render the frontmatter title as the single <h1>,
    // so a leading `# Heading` in the MDX body is demoted to <h2>.
    h1: ({ className, ...props }) => (
      <h2
        className={cn("font-display text-headline font-normal", className)}
        {...props}
      />
    ),
    h2: ({ className, ...props }) => (
      <h2
        className={cn(
          "mt-12 scroll-mt-28 font-display text-title font-medium text-foreground first:mt-0",
          className
        )}
        {...props}
      />
    ),
    h3: ({ className, ...props }) => (
      <h3
        className={cn(
          "mt-8 scroll-mt-28 text-xl font-medium tracking-tight text-foreground",
          className
        )}
        {...props}
      />
    ),
    h4: ({ className, ...props }) => (
      <h4
        className={cn(
          "mt-6 scroll-mt-28 text-base font-semibold text-foreground",
          className
        )}
        {...props}
      />
    ),
    p: ({ className, ...props }) => (
      <p
        className={cn("mt-4 leading-relaxed text-pretty", className)}
        {...props}
      />
    ),
    a: ({ className, ...props }) => (
      <ContentLink className={cn(proseLink, className)} {...props} />
    ),
    ul: ({ className, ...props }) => (
      <ul
        className={cn(
          "mt-4 list-disc space-y-2 pl-6 marker:text-primary/60",
          className
        )}
        {...props}
      />
    ),
    ol: ({ className, ...props }) => (
      <ol
        className={cn(
          "mt-4 list-decimal space-y-2 pl-6 marker:text-muted-foreground",
          className
        )}
        {...props}
      />
    ),
    li: ({ className, ...props }) => (
      <li
        className={cn("pl-1 leading-relaxed [&>p]:mt-2", className)}
        {...props}
      />
    ),
    strong: ({ className, ...props }) => (
      <strong
        className={cn("font-semibold text-foreground", className)}
        {...props}
      />
    ),
    blockquote: ({ className, ...props }) => (
      <blockquote
        className={cn(
          "mt-6 border-l-2 border-primary/40 pl-5 text-foreground/80 italic",
          className
        )}
        {...props}
      />
    ),
    hr: ({ className, ...props }) => (
      <hr className={cn("my-10 border-border", className)} {...props} />
    ),
    code: ({ className, ...props }) => (
      <code
        className={cn(
          "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.875em]",
          className
        )}
        {...props}
      />
    ),
    table: ({ className, ...props }) => (
      <div className="my-6 overflow-x-auto rounded-2xl border">
        <table
          className={cn("w-full text-left text-sm", className)}
          {...props}
        />
      </div>
    ),
    thead: ({ className, ...props }) => (
      <thead
        className={cn("bg-muted/60 text-foreground", className)}
        {...props}
      />
    ),
    th: ({ className, ...props }) => (
      <th className={cn("px-4 py-3 font-medium", className)} {...props} />
    ),
    td: ({ className, ...props }) => (
      <td
        className={cn("border-t px-4 py-3 align-top", className)}
        {...props}
      />
    ),
    Callout,
    Cards,
    Card,
    Steps,
    Step,
    Tabs,
    Tab,
    Accordions,
    Accordion: AccordionEntry,
    References,
    ...overrides,
  }
}
