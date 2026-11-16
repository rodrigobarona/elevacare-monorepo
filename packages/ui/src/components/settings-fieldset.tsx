import * as React from "react"

import { cn } from "@eleva/ui/lib/utils"

function SettingsFieldset({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="settings-fieldset"
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-1",
        className
      )}
      {...props}
    />
  )
}

type SettingsFieldsetContentProps = React.ComponentProps<"div"> & {
  /** `aside` / `avatar`: title left, control top-right */
  layout?: "default" | "avatar" | "aside"
}

function SettingsFieldsetContent({
  className,
  layout = "default",
  ...props
}: SettingsFieldsetContentProps) {
  return (
    <div
      data-slot="settings-fieldset-content"
      className={cn(
        "p-6",
        (layout === "avatar" || layout === "aside") &&
          "relative min-h-[7rem] pr-28 sm:pr-44",
        className
      )}
      {...props}
    />
  )
}

type SettingsFieldsetTitleProps<T extends React.ElementType = "h3"> = {
  as?: T
} & Omit<React.ComponentPropsWithoutRef<T>, "as">

function SettingsFieldsetTitle<T extends React.ElementType = "h3">({
  as,
  className,
  ...props
}: SettingsFieldsetTitleProps<T>) {
  const Tag = (as ?? "h3") as React.ElementType
  return (
    <Tag
      data-slot="settings-fieldset-title"
      className={cn(
        "font-display text-xl leading-snug font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function SettingsFieldsetDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="settings-fieldset-description"
      className={cn("mt-1 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function SettingsFieldsetFooter({
  className,
  ...props
}: React.ComponentProps<"footer">) {
  return (
    <footer
      data-slot="settings-fieldset-footer"
      className={cn(
        "flex flex-col gap-3 border-t border-border bg-sand-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:bg-muted/40",
        className
      )}
      {...props}
    />
  )
}

function SettingsFieldsetStatus({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-fieldset-status"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function SettingsFieldsetActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-fieldset-actions"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  )
}

/** Positions a control top-right inside `layout="avatar"` or `layout="aside"` content. */
function SettingsFieldsetAsideSlot({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-fieldset-aside"
      className={cn("absolute top-6 right-6", className)}
      {...props}
    />
  )
}

type SettingsRowProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** What the setting is, in a few words. */
  title: React.ReactNode
  /** One line on what it changes for the person. */
  description?: React.ReactNode
  /** Small extra line under the description (a date, a state). */
  meta?: React.ReactNode
  /** Put a wide control (several switches) under the text on phones. */
  stack?: boolean
}

/**
 * One setting in a list: what it is on the left, its control on the right,
 * on the same line at every width (`stack` puts a wide control under the
 * text on phones). Rows are separated by a hairline.
 */
function SettingsRow({
  title,
  description,
  meta,
  stack = false,
  children,
  className,
  ...props
}: SettingsRowProps) {
  return (
    <div
      data-slot="settings-row"
      className={cn(
        "flex items-start justify-between gap-4 border-t border-border/70 py-4 first:border-t-0 first:pt-0 last:pb-0 sm:gap-6",
        stack && "flex-col sm:flex-row",
        className
      )}
      {...props}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="text-sm font-medium">{title}</div>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
        {meta ? (
          <div className="text-xs text-muted-foreground">{meta}</div>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  )
}

function SettingsFieldsetAvatarSlot({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <SettingsFieldsetAsideSlot className={className} {...props} />
}

export {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetAsideSlot,
  SettingsFieldsetAvatarSlot,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetStatus,
  SettingsFieldsetTitle,
  SettingsRow,
}
