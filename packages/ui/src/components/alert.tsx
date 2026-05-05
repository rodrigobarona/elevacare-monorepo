import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@eleva/ui/lib/utils"

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
        info: "border-primary/30 bg-primary/5 text-foreground [&>svg]:text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  role,
  "aria-live": ariaLive,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  // `destructive` is a hard error → assertive `role="alert"` so screen
  // readers interrupt. `default`/`info` are advisory → polite
  // `role="status"` so reading flow isn't interrupted. Consumers can
  // still override via the `role`/`aria-live` props.
  const isDestructive = variant === "destructive"
  const computedRole = role ?? (isDestructive ? "alert" : "status")
  const computedAriaLive = ariaLive ?? (isDestructive ? undefined : "polite")
  return (
    <div
      data-slot="alert"
      role={computedRole}
      aria-live={computedAriaLive}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
