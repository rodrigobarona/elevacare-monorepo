import { Section } from "react-email"
import type { ReactNode } from "react"

export function EmailCard({
  children,
  variant = "branded",
}: {
  children: ReactNode
  variant?: "branded" | "muted" | "danger"
}) {
  const surface =
    variant === "danger"
      ? "border-danger bg-bg"
      : variant === "muted"
        ? "border-stroke bg-bg-muted"
        : "border-stroke-brand bg-bg-2"

  return (
    <Section
      className={`${surface} rounded-[12px] border border-solid px-[20px] py-[20px]`}
    >
      {children}
    </Section>
  )
}
