import Link from "next/link"

export default function Page() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-medium">Eleva.care · docs</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Public docs placeholder. Portugal compliance content lands in Sprint
          8.
        </p>
        <Link
          href="/design-system"
          className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          Design system
        </Link>
      </div>
    </main>
  )
}
