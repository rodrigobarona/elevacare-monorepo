import { Button } from "react-email"
import type { ReactNode } from "react"

export function EmailButton({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Button
      href={href}
      className="bg-brand text-fg-inverted box-border inline-block rounded-[8px] px-[32px] py-[16px] text-center text-[16px] leading-[20px] font-semibold no-underline"
    >
      {children}
    </Button>
  )
}
