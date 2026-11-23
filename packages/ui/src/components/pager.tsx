import Link from "next/link"

import { buttonVariants } from "@eleva/ui/components/button-variants"
import { cn } from "@eleva/ui/lib/utils"

interface PagerProps {
  /** Where the reader is, in words: "Showing 26 to 50 of 112". */
  range: string
  /** Said after the range on the last of several pages. */
  end?: string
  /**
   * The pages on either side; null where there is none. Leave the whole
   * prop out for a list that fits on one page: controls that can never do
   * anything are not shown.
   */
  links?: { previous: string | null; next: string | null }
  labels: {
    /** Names the landmark: "Pages". */
    landmark: string
    previous: string
    next: string
    /** Accessible names; they contain the visible word. */
    previousPage: string
    nextPage: string
  }
  /** So a table can point at the range with `aria-describedby`. */
  rangeId?: string
  className?: string
}

// The kit's outline is a hairline, and the footer's text is muted. A
// control that is the only way to the next page gets a border that can be
// seen (3:1) and full-strength words; the unavailable one stays in place,
// quieter but still readable.
const control = cn(
  buttonVariants({ variant: "outline", size: "sm" }),
  "border-input-border"
)
const available = cn(control, "text-foreground")
const unavailable = cn(
  control,
  "pointer-events-none text-muted-foreground opacity-70"
)

function PageLink({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: string
}) {
  // At either end the control stays where it is, so nothing jumps; it is
  // not a link any more, says so, and is out of the tab order.
  if (!href) {
    return (
      <span
        role="link"
        aria-disabled="true"
        aria-label={label}
        className={unavailable}
      >
        {children}
      </span>
    )
  }
  return (
    // Never fetched ahead: on a staff queue each page read is recorded,
    // and a page nobody opened must leave no record.
    <Link href={href} prefetch={false} aria-label={label} className={available}>
      {children}
    </Link>
  )
}

/**
 * The footer of a paged list: the range in words, then Previous and Next as
 * real links, so the page survives Back, a reload and a shared address.
 * For the `footer` of a `DataTableShell`.
 */
export function Pager({
  range,
  end,
  links,
  labels,
  rangeId,
  className,
}: PagerProps) {
  return (
    <div
      data-slot="pager"
      className={cn(
        "flex w-full flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p id={rangeId}>
        {range}
        {/* The range is a phrase; with a sentence after it, it needs its
            stop. The sentence moves to the next line whole, never broken. */}
        {end ? ". " : null}
        {end ? <span className="inline-block">{end}</span> : null}
      </p>
      {links ? (
        <nav
          aria-label={labels.landmark}
          className="flex shrink-0 gap-2 max-sm:*:flex-1"
        >
          <PageLink href={links.previous} label={labels.previousPage}>
            {labels.previous}
          </PageLink>
          <PageLink href={links.next} label={labels.nextPage}>
            {labels.next}
          </PageLink>
        </nav>
      ) : null}
    </div>
  )
}
