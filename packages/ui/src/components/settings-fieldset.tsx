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
        "overflow-hidden rounded-lg border border-border bg-background text-foreground",
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
      className={cn("text-xl font-semibold tracking-tight", className)}
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
        "flex flex-col gap-3 border-t border-border bg-muted/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
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
}
