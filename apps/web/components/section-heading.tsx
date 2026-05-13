import { cn } from "@eleva/ui/lib/utils"

interface SectionHeadingProps {
  children: React.ReactNode
  className?: string
  as?: "h1" | "h2" | "h3"
}

export function SectionHeading({
  children,
  className,
  as: Tag = "h2",
}: SectionHeadingProps) {
  return (
    <Tag
      className={cn(
        "font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl",
        "[&>strong]:font-bold",
        className
      )}
    >
      {children}
    </Tag>
  )
}
