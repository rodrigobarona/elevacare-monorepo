import Link from "next/link"
import { ArrowRightIcon } from "@eleva/icons"
import { POC_DOMAINS } from "@/lib/poc-catalog"

export default function PocHubPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-border/60 bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-sm font-medium tracking-wider text-muted-foreground uppercase">
            Eleva · Product PoCs
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Interactive walkthrough gallery
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Runnable mocks for client review. Each domain groups related flows —
            onboarding, public profile, booking, and more as we add them.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            Run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              pnpm --filter @eleva/poc dev
            </code>{" "}
            · port 3099
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {POC_DOMAINS.map((domain) => (
            <Link
              key={domain.slug}
              href={domain.status === "live" ? domain.href : domain.href}
              className="group flex flex-col rounded-2xl border border-border/60 bg-background p-6 shadow-sm transition-all hover:border-eleva-primary/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {domain.status === "live" ? "Live" : "Planned"}
                </p>
                {((domain.onboardingLabs?.length ?? 0) +
                  (domain.setupLabs?.length ?? 0) ||
                  domain.walkthroughs.length) > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {(domain.onboardingLabs?.length ?? 0) +
                      (domain.setupLabs?.length ?? 0) ||
                      domain.walkthroughs.length}{" "}
                    prototypes
                  </span>
                ) : null}
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight group-hover:text-eleva-primary">
                {domain.title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                {domain.description}
              </p>
              <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
                <span className="text-xs text-muted-foreground">
                  {domain.specPath}
                </span>
                {domain.status === "live" ? (
                  <ArrowRightIcon className="size-4 text-eleva-primary transition-transform group-hover:translate-x-1" />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Coming soon
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          Spec docs: <code className="text-xs">_context/PoCs/readme.md</code>
        </p>
      </div>
    </div>
  )
}
