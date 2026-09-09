import Link from "next/link"
import { getPocDomain } from "@/lib/poc-catalog"

export default function BookingFlowPlaceholderPage() {
  const domain = getPocDomain("booking-flow")

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 text-center">
      <Link
        href="/"
        className="absolute top-6 left-6 text-sm text-muted-foreground hover:text-foreground"
      >
        ← All PoCs
      </Link>
      <p className="text-sm font-medium tracking-wider text-muted-foreground uppercase">
        Planned
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {domain?.title}
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        {domain?.description}
      </p>
      <p className="mt-8 text-sm text-muted-foreground">
        Spec stub: <code className="text-xs">{domain?.specPath}</code>
      </p>
    </div>
  )
}
