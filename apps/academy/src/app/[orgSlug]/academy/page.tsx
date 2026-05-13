import { redirect } from "next/navigation"
import { getSession } from "@eleva/auth/server"

export default async function AcademyHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSession()

  if (!session) {
    redirect("/signin")
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Eleva Academy</h1>
      <p className="text-muted-foreground">
        Course management for {orgSlug}. Coming soon.
      </p>
    </main>
  )
}
