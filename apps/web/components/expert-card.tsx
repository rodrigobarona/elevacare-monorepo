import Image from "next/image"
import { BadgeCheck } from "lucide-react"

import { Badge } from "@eleva/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import { Link } from "@/i18n/navigation"
import type { PublicExpertCard } from "@eleva/db"

interface ExpertCardProps {
  expert: PublicExpertCard
  labels: {
    topExpert: string
    languagesLabel: string
    countriesLabel: string
    viewProfile: string
    sessionMode: Record<string, string>
  }
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
      <Card className="h-full border-border/60 transition-all group-hover:border-primary/30 group-hover:shadow-lg">
        <CardHeader className="flex flex-row items-start gap-4">
          <Avatar className="size-14 shrink-0">
            {expert.avatarUrl && <AvatarImage src={expert.avatarUrl} alt="" />}
            <AvatarFallback className="text-sm">
              {initials(expert.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className="truncate font-heading text-base">
                {expert.displayName}
              </CardTitle>
              <BadgeCheck className="size-4 shrink-0 text-primary" />
            </div>
            {expert.headline && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {expert.headline}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {expert.categorySlugs.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {expert.categorySlugs.slice(0, 3).map((slug) => (
                <Badge key={slug} variant="outline" className="text-[10px]">
                  {slug}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {expert.languages.length > 0 && (
              <span>
                {labels.languagesLabel}:{" "}
                {expert.languages.map((l) => l.toUpperCase()).join(", ")}
              </span>
            )}
            {expert.practiceCountries.length > 0 && (
              <span>
                {labels.countriesLabel}: {expert.practiceCountries.join(", ")}
              </span>
            )}
          </div>
          {expert.topExpertActive && (
            <Badge variant="secondary" className="mt-3 text-[10px]">
              {labels.topExpert}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
