import { Column, Row, Text } from "react-email"

interface DetailRowProps {
  label: string
  value: string
  bold?: boolean
  /** Additional Tailwind classes on the value Text, e.g. "text-danger". */
  valueClassName?: string
}

export function DetailRow({
  label,
  value,
  bold,
  valueClassName,
}: DetailRowProps) {
  const valueCls = [
    "text-fg m-0 text-[15px] leading-[24px]",
    bold ? "font-semibold" : "font-medium",
    valueClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <Row className="mb-[8px]">
      <Column className="w-[120px] align-top">
        <Text className="text-fg-3 m-0 text-[13px] leading-[24px]">
          {label}
        </Text>
      </Column>
      <Column className="align-top">
        <Text className={valueCls}>{value}</Text>
      </Column>
    </Row>
  )
}
