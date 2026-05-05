import * as React from "react"

import { cn } from "@eleva/ui/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-2xl border bg-card py-6 text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6",
        className
      )}
      {...props}
    />
  )
}

type CardTitleProps<T extends React.ElementType = "h3"> = {
  as?: T
} & Omit<React.ComponentPropsWithoutRef<T>, "as">

function CardTitle<T extends React.ElementType = "h3">({
  as,
  className,
  ...props
}: CardTitleProps<T>) {
  // Default to <h3> so card headings appear in the a11y tree. Page-level
  // <h1> sits above; sections nest <h2>; cards inside sections nest <h3>.
  // Override via `as` when consumers need a different level.
  const Tag = (as ?? "h3") as React.ElementType
  return (
    <Tag
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
