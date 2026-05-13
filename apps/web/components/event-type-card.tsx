import { Clock, Globe2, Video, MapPin, Phone } from "lucide-react"

import { Badge } from "@eleva/ui/components/badge"
import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Link } from "@/i18n/navigation"

interface EventTypeCardProps {
  username: string
  slug: string
  title: string
  description: string | null
  durationMinutes: number
  priceAmount: number
  priceCurrency: string
  languages: string[]
  sessionMode: string
  bookLabel: string
}

const modeIcons: Record<string, typeof Video> = {
  online: Video,
  in_person: MapPin,
  phone: Phone,
}

export function EventTypeCard({
  username,
  slug,
  title,
  description,
  durationMinutes,
  priceAmount,
  priceCurrency,
  languages,
  sessionMode,
  bookLabel,
}: EventTypeCardProps) {
  const ModeIcon = modeIcons[sessionMode] ?? Video

  return (
    <Card className="border-border/60 transition-colors hover:border-primary/30">
      <CardHeader>
        <CardTitle className="font-heading text-base">{title}</CardTitle>
        {description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="size-3" />
            {durationMinutes} min
          </Badge>
          <Badge variant="outline" className="gap-1 text-xs">
            <ModeIcon className="size-3" />
            {sessionMode}
          </Badge>
          {languages.length > 0 && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Globe2 className="size-3" />
              {languages.map((l) => l.toUpperCase()).join(", ")}
            </Badge>
          )}
          <Badge className="ml-auto text-xs font-semibold">
            {new Intl.NumberFormat("pt-PT", {
              style: "currency",
              currency: priceCurrency,
            }).format(priceAmount / 100)}
          </Badge>
        </div>
        <div className="mt-4">
          <Button size="sm" className="w-full" asChild>
            <Link href={`/${username}/${slug}`}>{bookLabel}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
