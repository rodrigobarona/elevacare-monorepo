import { ArrowRight, Globe2, MapPin } from "lucide-react"

import type { PublicExpertCard } from "@eleva/db"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import { Badge } from "@eleva/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Link } from "@/i18n/navigation"

export interface ExpertCardLabels {
  topExpert: string
  languagesLabel: string
  countriesLabel: string
  viewProfile: string
  sessionMode: Record<"online" | "in_person" | "phone", string>
}

interface ExpertCardProps {
  expert: PublicExpertCard
  labels: ExpertCardLabels
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "EL"
}

export function ExpertCard({ expert, labels }: ExpertCardProps) {
  return (
    <Link
      href={`/${expert.username}`}
      className="group block rounded-2xl focus-visible:ring-3 focus-visible:ring-ring"
    >
      <Card className="h-full border-border/60 transition-colors group-hover:shadow-md hover:border-primary/40">
        <CardHeader className="flex-row items-start gap-4">
          <Avatar className="size-14 shrink-0">
            {expert.avatarUrl ? (
              <AvatarImage src={expert.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback>{initials(expert.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="truncate font-heading text-base sm:text-lg">
                {expert.displayName}
              </CardTitle>
              {expert.topExpertActive ? (
                <Badge variant="secondary" className="shrink-0">
                  {labels.topExpert}
                </Badge>
              ) : null}
            </div>
            {expert.headline ? (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {expert.headline}
              </p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pb-6 text-sm">
          {expert.languages.length > 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe2 className="size-4 shrink-0 text-primary" />
              <span className="font-medium text-foreground/80">
                {labels.languagesLabel}:
              </span>
              <span className="truncate">
                {expert.languages.map((l) => l.toUpperCase()).join(" · ")}
              </span>
            </div>
          ) : null}
          {expert.practiceCountries.length > 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="font-medium text-foreground/80">
                {labels.countriesLabel}:
              </span>
              <span className="truncate">
                {expert.practiceCountries.join(" · ")}
              </span>
            </div>
          ) : null}
          {expert.sessionModes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {expert.sessionModes.map((mode) => (
                <Badge key={mode} variant="outline" className="text-xs">
                  {labels.sessionMode[mode]}
                </Badge>
              ))}
            </div>
          ) : null}
          <div className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
            {labels.viewProfile}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
