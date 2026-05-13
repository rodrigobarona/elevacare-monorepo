import { ArrowRight } from "lucide-react"

import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@eleva/ui/components/card"
import { Link } from "@/i18n/navigation"

interface AudienceOption {
  title: string
  body: string
  href: string
  cta: string
}

interface AudienceSplitProps {
  items: AudienceOption[]
}

export function AudienceSplit({ items }: AudienceSplitProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item, i) => (
        <Card
          key={`${item.href}-${i}`}
          className="border-border/60 transition-colors hover:border-primary/40"
        >
          <CardHeader>
            <CardTitle className="font-heading text-lg">{item.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{item.body}</p>
            <Button variant="outline" size="sm" asChild>
              <Link href={item.href}>
                {item.cta}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
