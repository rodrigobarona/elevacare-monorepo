import { redirect, notFound } from "next/navigation"
import { getSession } from "@eleva/auth/server"
import { getApplicationById } from "@eleva/db"
import { Badge } from "@eleva/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Separator } from "@eleva/ui/components/separator"
import { AppShell } from "@/components/app-shell"
import { ApplicationActions } from "./application-actions"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ApplicationDetailPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/signin")
  if (!session.capabilities.includes("applications:review")) redirect("/")

  const { id } = await params
  const app = await getApplicationById(id)
  if (!app) notFound()

  const canAct = app.status === "submitted" || app.status === "under_review"

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-medium">{app.displayName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              @{app.usernameRequested} &middot; {app.type.replace("_", " ")}
            </p>
          </div>
          <Badge
            variant={
              app.status === "approved"
                ? "outline"
                : app.status === "rejected"
                  ? "destructive"
                  : "default"
            }
          >
            {app.status.replace("_", " ")}
          </Badge>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Applicant Info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" value={app.applicantEmail ?? "—"} />
              <Field
                label="Display Name"
                value={app.applicantDisplayName ?? "—"}
              />
              <Field label="NIF" value={app.nif ?? "—"} />
              <Field label="License #" value={app.licenseNumber ?? "—"} />
              <Field label="License Scope" value={app.licenseScope ?? "—"} />
              <Field
                label="Languages"
                value={app.languages.join(", ") || "—"}
              />
              <Field
                label="Practice Countries"
                value={app.practiceCountries.join(", ") || "—"}
              />
              <Field
                label="Categories"
                value={app.categorySlugs.join(", ") || "—"}
              />
            </dl>
          </CardContent>
        </Card>

        {app.bio && (
          <Card>
            <CardHeader>
              <CardTitle>Bio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{app.bio}</p>
            </CardContent>
          </Card>
        )}

        {app.documents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Documents ({app.documents.length})</CardTitle>
              <CardDescription>Uploaded supporting files</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {app.documents.map((doc, i) => (
                  <li
                    key={`${doc.kind}-${i}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <span className="text-sm font-medium">{doc.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {doc.kind} &middot; {(doc.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 underline hover:no-underline"
                    >
                      View
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {app.rejectionReason && (
          <Card>
            <CardHeader>
              <CardTitle>Rejection Reason</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive">{app.rejectionReason}</p>
            </CardContent>
          </Card>
        )}

        <Separator />

        {canAct && (
          <ApplicationActions applicationId={app.id} status={app.status} />
        )}

        <div className="text-xs text-muted-foreground">
          Created: {new Date(app.createdAt).toLocaleString("en-GB")}
          {app.reviewedAt && (
            <>
              {" "}
              &middot; Reviewed:{" "}
              {new Date(app.reviewedAt).toLocaleString("en-GB")}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  )
}
