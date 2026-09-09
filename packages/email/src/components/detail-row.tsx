import { Column, Row, Text } from "react-email"

interface DetailRowProps {
  label: string
  value: string
  bold?: boolean
  /** Additional Tailwind classes on the value Text, e.g. "text-danger line-through". */
  valueClassName?: string
}

export function DetailRow({
  label,
  value,
  bold,
  valueClassName,
}: DetailRowProps) {
  const base = "text-fg m-0 text-[14px]"
  const cls = [base, bold ? "font-medium" : "", valueClassName ?? ""]
    .filter(Boolean)
    .join(" ")

  return (
    <Row className="mb-2">
      <Column className="w-[110px] align-top">
        <Text className="text-fg-3 m-0 text-[13px]">{label}</Text>
      </Column>
      <Column className="align-top">
        <Text className={cls}>{value}</Text>
      </Column>
    </Row>
  )
}
