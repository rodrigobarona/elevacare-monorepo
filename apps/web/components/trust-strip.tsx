import { ShieldCheck, Globe2, Clock, BadgeCheck } from "lucide-react"

interface TrustStripProps {
  items: Array<{ icon: "shield" | "globe" | "clock" | "check"; label: string }>
}

const icons = {
  shield: ShieldCheck,
  globe: Globe2,
  clock: Clock,
  check: BadgeCheck,
} as const

export function TrustStrip({ items }: TrustStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
      {items.map((item, i) => {
        const Icon = icons[item.icon]
        return (
          <span key={i} className="inline-flex items-center gap-2">
            <Icon className="size-4 text-primary" />
            {item.label}
          </span>
        )
      })}
    </div>
  )
}
