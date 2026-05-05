/**
 * Server helpers shared by the public marketplace surfaces:
 * `app/[locale]/experts/page.tsx`, `app/[locale]/experts/[category]/page.tsx`,
 * and `app/[locale]/become-partner/page.tsx`.
 *
 * `safeList*` here means "logs and rethrows on DB failure" so the Next.js
 * error boundary fires; an empty list returned from a successful query
 * is a legitimate UX state and is left untouched.
 */
import { cache } from "react"

import {
  listCategories,
  listExperts,
  type ListExpertsFilters,
  type ListExpertsResult,
  type PublicCategory,
} from "@eleva/db"

export const safeListCategories = cache(async (): Promise<PublicCategory[]> => {
  try {
    return await listCategories()
  } catch (err) {
    console.error("listCategories failed", err)
    throw err
  }
})

export async function safeListExperts(
  filters: ListExpertsFilters
): Promise<ListExpertsResult> {
  try {
    return await listExperts(filters)
  } catch (err) {
    console.error("listExperts failed", err)
    throw err
  }
}

export function pickCategoryName(
  c: PublicCategory,
  locale: string
): { slug: string; name: string } {
  return {
    slug: c.slug,
    name: c.displayName[locale] ?? c.displayName.en,
  }
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card p-10 text-center">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
