import { Text } from "react-email"
import type { ReactNode } from "react"

export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Text className="text-fg-2 m-0 mb-[12px] font-serif text-[28px] leading-[34px] font-normal">
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
