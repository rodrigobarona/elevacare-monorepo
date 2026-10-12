import { Button } from "react-email"
import type { ReactNode } from "react"

export function EmailButton({
  href,
  children,
  variant = "primary",
}: {
  href: string
  children: ReactNode
  variant?: "primary" | "secondary"
}) {
  const className =
    variant === "secondary"
      ? "border-brand text-brand box-border inline-block rounded-[8px] border border-solid px-[32px] py-[16px] text-center text-[16px] leading-[20px] font-semibold no-underline"
      : "bg-brand text-fg-inverted box-border inline-block rounded-[8px] px-[32px] py-[16px] text-center text-[16px] leading-[20px] font-semibold no-underline"
  return (
    <Button href={href} className={className}>
      {children}
    </Button>
  )
}
