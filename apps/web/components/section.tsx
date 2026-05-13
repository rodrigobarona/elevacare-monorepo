import { cn } from "@eleva/ui/lib/utils"

interface SectionProps {
  children: React.ReactNode
  className?: string
  as?: "section" | "div"
  id?: string
}

export function Section({
  children,
  className,
  as: Tag = "section",
  id,
}: SectionProps) {
  return (
    <Tag id={id} className={cn("py-16 sm:py-24", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
    </Tag>
  )
}
