import { Text } from "react-email"
import type { ReactNode } from "react"

export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Text className="text-brand m-0 mb-[8px] text-[24px] leading-[30px] font-semibold">
      {children}
    </Text>
  )
}

export function EmailBodyText({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Text
      className={`text-fg-3 m-0 text-[16px] leading-[26px] ${className ?? ""}`}
    >
      {children}
    </Text>
  )
}
