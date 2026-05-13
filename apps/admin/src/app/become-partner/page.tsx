import Link from "next/link"
import { getSession } from "@eleva/auth/server"
import { listApplications, type ListApplicationsFilters } from "@eleva/db"
import { Badge } from "@eleva/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"

export const dynamic = "force-dynamic"

const VALID_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "rejected",
] as const

function isValidStatus(
  value: string
): value is ListApplicationsFilters["status"] & string {
  return (VALID_STATUSES as readonly string[]).includes(value)
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  submitted: "default",
  under_review: "secondary",
  approved: "outline",
  rejected: "destructive",
}

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function BecomePartnerQueuePage({ searchParams }: Props) {
  const session = await getSession()

  const query = await searchParams
  const filters: ListApplicationsFilters = { limit: 25, offset: 0 }

  if (query.status && query.status !== "all" && isValidStatus(query.status)) {
    filters.status = query.status
  }
  if (query.page) {
    const p = Math.max(1, parseInt(query.page, 10) || 1)
    filters.offset = (p - 1) * 25
  }

  const { rows, total } = await listApplications(filters)

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-medium">Become-Partner Applications</h1>
        <p className="text-sm text-muted-foreground">
          {total} application{total !== 1 ? "s" : ""} total
        </p>
      </header>

      <nav className="mb-4 flex gap-2">
        {["all", "submitted", "under_review", "approved", "rejected"].map(
          (s) => (
            <Link
              key={s}
              href={`/become-partner${s === "all" ? "" : `?status=${s}`}`}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/50 ${
                (query.status ?? "all") === s
                  ? "border-foreground/20 bg-muted"
                  : "border-transparent"
              }`}
            >
              {s.replace("_", " ")}
            </Link>
          )
        )}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No applications match the current filter.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((app) => (
            <Link
              key={app.id}
              href={`/become-partner/${app.id}`}
              className="block"
            >
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {app.displayName}
                    </CardTitle>
                    <Badge variant={STATUS_VARIANT[app.status] ?? "secondary"}>
                      {app.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <CardDescription>
                    @{app.usernameRequested} &middot;{" "}
                    {app.type.replace("_", " ")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      Categories: {app.categorySlugs.join(", ") || "none"}
                    </span>
                    <span>Docs: {app.documents.length}</span>
                    <span>
                      Submitted:{" "}
                      {new Date(app.createdAt).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
