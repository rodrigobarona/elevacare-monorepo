import Link from "next/link"
import { ArrowRightIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"
import {
  EXPERT_ONBOARDING_LABS,
  EXPERT_ONBOARDING_WALKTHROUGHS,
  EXPERT_SETUP_LABS,
  getPocDomain,
  type LabWalkthrough,
} from "@/lib/poc-catalog"

function LabThumbnail({ lab }: { lab: LabWalkthrough }) {
  const id = lab.id
  return (
    <div className="mt-3 h-8 overflow-hidden rounded-lg bg-muted/50">
      {id.startsWith("o") && (
        <div className="flex h-full items-center gap-0.5 px-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i <= 1 ? "bg-eleva-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      )}
      {id.startsWith("s") && (
        <div className="flex h-full flex-col justify-center gap-0.5 px-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-full rounded bg-stone-300" />
          ))}
        </div>
      )}
    </div>
  )
}

function LabCard({ lab }: { lab: LabWalkthrough }) {
  return (
    <Link
      href={lab.href}
      className="group flex flex-col rounded-2xl border border-border/60 bg-background p-5 shadow-sm transition-all hover:border-eleva-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {lab.id.toUpperCase()} · {lab.implementation}
        </p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
            lab.phase === "onboarding"
              ? "bg-sky-100 text-sky-800"
              : "bg-amber-100 text-amber-900"
          )}
        >
          {lab.phase === "onboarding" ? "Onboarding" : "Setting up"}
        </span>
      </div>
      <LabThumbnail lab={lab} />
      <h3 className="mt-3 text-lg font-semibold tracking-tight group-hover:text-eleva-primary">
        {lab.title}
      </h3>
      <p className="text-sm text-muted-foreground">{lab.subtitle}</p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {lab.tagline}
      </p>
      <p className="mt-3 text-xs text-eleva-primary/80">
        Starts at Create workspace modal
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
        <span className="text-xs text-muted-foreground">{lab.bestFor}</span>
        <ArrowRightIcon className="size-4 text-eleva-primary transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  )
}

export default function ExpertOnboardingHubPage() {
  const domain = getPocDomain("expert-onboarding")
  if (!domain) return null

  const onboarding = domain.onboardingLabs ?? EXPERT_ONBOARDING_LABS
  const setup = domain.setupLabs ?? EXPERT_SETUP_LABS
  const archived = domain.walkthroughs.filter((w) => w.status === "archived")

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-border/60 bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← All PoCs
          </Link>
          <p className="mt-4 text-xs font-semibold tracking-widest text-eleva-primary uppercase">
            Expert Workspace Lab · v4
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {domain.title}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {domain.description}
          </p>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
            Every lab opens with the same <strong>Create workspace</strong>{" "}
            modal as classic PoC A–E (Expert → Continue). No account signup,
            email, or OTP in this gallery.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <section id="onboarding">
          <h2 className="text-lg font-semibold">Workspace onboarding</h2>
          <p className="text-sm text-muted-foreground">
            Build draft Expert Space → draft saved handoff.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {onboarding.map((lab) => (
              <LabCard key={lab.slug} lab={lab} />
            ))}
          </div>
        </section>

        <section id="setting-up" className="mt-16">
          <h2 className="text-lg font-semibold">Setting up your Space</h2>
          <p className="text-sm text-muted-foreground">
            Same modal entry, then publish tasks on an existing draft.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {setup.map((lab) => (
              <LabCard key={lab.slug} lab={lab} />
            ))}
          </div>
        </section>

        {archived.length > 0 && (
          <details className="mt-16 rounded-2xl border border-dashed border-border/80 bg-muted/20">
            <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-muted-foreground hover:text-foreground">
              Classic wizard explorations (A–E) — archived · still runnable
            </summary>
            <div className="grid gap-4 border-t border-border/40 p-6 md:grid-cols-2 lg:grid-cols-3">
              {archived.map((poc) => (
                <Link
                  key={poc.slug}
                  href={poc.href}
                  className="group rounded-xl border border-border/40 bg-background/60 p-4 opacity-80 transition hover:opacity-100"
                >
                  <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    PoC {poc.id.toUpperCase()} · archived
                  </p>
                  <h3 className="mt-1 font-semibold group-hover:text-eleva-primary">
                    {poc.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {poc.tagline}
                  </p>
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
