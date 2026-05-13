import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@eleva/ui/components/card"
import { Link } from "@/i18n/navigation"

interface CategoryCardProps {
  slug: string
  name: string
  description: string | null
}

export function CategoryCard({ slug, name, description }: CategoryCardProps) {
  return (
    <Link
      href={`/experts/${slug}`}
      className="group block rounded-2xl focus-visible:ring-3 focus-visible:ring-ring"
    >
      <Card className="h-full border-border/60 transition-all group-hover:border-primary/40 group-hover:shadow-md">
        <CardHeader>
          <CardTitle className="font-heading text-lg">{name}</CardTitle>
          {description && (
            <CardDescription className="line-clamp-2">
              {description}
            </CardDescription>
          )}
        </CardHeader>
      </Card>
    </Link>
  )
}
