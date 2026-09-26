import { cn } from "@eleva/ui/lib/utils"

export function CancellationPolicySummary({
  heading,
  name,
  lines,
  deadlines,
  className,
}: {
  heading: string
  name: string
  lines: readonly string[]
  /** Pre-formatted deadlines for a concrete booking, in the member's time zone. */
  deadlines?: readonly string[]
  className?: string
}) {
  return (
    <section
      data-slot="cancellation-policy-summary"
      data-testid="cancellation-policy-summary"
      className={cn("space-y-2 text-sm", className)}
    >
      <p className="font-medium">
        {heading}: {name}
      </p>
      <ul className="space-y-1 text-muted-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {deadlines && deadlines.length > 0 ? (
        <ul className="space-y-1">
          {deadlines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
