"use client"

import * as React from "react"
import type { CheckboxProps } from "react-aria-components"
import { cn } from "@eleva/ui/lib/utils"
import { Checkbox } from "@eleva/ui/components/checkbox"
import { Field, FieldLabel } from "@eleva/ui/components/field"

interface CheckboxFieldProps extends Omit<
  CheckboxProps,
  "children" | "className"
> {
  /** Visible label. Clicking it toggles the checkbox. */
  label: React.ReactNode
  /** Optional stable id; generated with `useId` when omitted. */
  id?: string
  className?: string
  labelClassName?: string
}

/**
 * Checkbox + label pair. React Aria's `Checkbox` renders its own `<label>`
 * root, so wrapping it in another `<label>` produces invalid nested labels.
 * This composes the `Field` horizontal layout with an explicit `htmlFor`.
 */
function CheckboxField({
  id,
  label,
  className,
  labelClassName,
  ...props
}: CheckboxFieldProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  return (
    <Field orientation="horizontal" className={cn("w-auto gap-2", className)}>
      <Checkbox id={inputId} {...props} />
      <FieldLabel
        htmlFor={inputId}
        className={cn("font-normal", labelClassName)}
      >
        {label}
      </FieldLabel>
    </Field>
  )
}

export { CheckboxField }
