import type { Metadata } from "next"

import { Alert, AlertDescription, AlertTitle } from "@eleva/ui/components/alert"
import { Badge } from "@eleva/ui/components/badge"
import { Logo, LogoMark, VerifiedBadge } from "@eleva/ui/components/brand"
import { Button } from "@eleva/ui/components/button"
import { DataTableShell } from "@eleva/ui/components/data-table-shell"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  PageHeader,
  Section,
  Stat,
  StatGrid,
} from "@eleva/ui/components/page-header"
import { Skeleton } from "@eleva/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eleva/ui/components/table"

export const metadata: Metadata = {
  title: "Design system · Eleva Care",
  description: "Brand v2 tokens and the shared @eleva/ui kit.",
}

const SCALES = [
  "teal",
  "coral",
  "neutral",
  "success",
  "warning",
  "danger",
  "info",
] as const
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

const SEMANTIC = [
  ["background", "foreground"],
  ["card", "card-foreground"],
  ["primary", "primary-foreground"],
  ["secondary", "secondary-foreground"],
  ["accent", "accent-foreground"],
  ["muted", "muted-foreground"],
  ["success-subtle", "success"],
  ["warning-subtle", "warning"],
  ["info-subtle", "info"],
  ["destructive-subtle", "destructive"],
] as const

const CHARTS = [1, 2, 3, 4, 5] as const

const SAMPLE_ROWS = [
  { id: "1", member: "Ana S.", service: "First visit", amount: "€60.00" },
  { id: "2", member: "João M.", service: "Follow-up", amount: "€45.00" },
] as const

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-16 px-6 py-12">
      <PageHeader
        eyebrow="Brand v2"
        title="Eleva design system"
        description="Tokens and components shared by every Eleva app. Source of truth: docs/eleva-v3/brand-book/v2 and @eleva/ui."
      />

      <Section title="Brand" description="Logo assets inherit currentColor.">
        <div className="flex flex-wrap items-center gap-8 rounded-xl border bg-card p-6">
          <Logo className="h-9" />
          <LogoMark className="size-12" />
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <VerifiedBadge /> Verified expert
          </span>
          <div className="rounded-lg bg-primary p-3 text-primary-foreground">
            <Logo className="h-7 text-current" />
          </div>
        </div>
      </Section>

      <Section
        title="Color scales"
        description="OKLCH scales on a fixed lightness ladder. Use semantic tokens in product code; scales are for tokens and illustrations."
      >
        <div className="space-y-3">
          {SCALES.map((scale) => (
            <div
              key={scale}
              className="grid grid-cols-[6rem_1fr] items-center gap-3"
            >
              <span className="font-mono text-xs">{scale}</span>
              <div className="grid grid-cols-11 overflow-hidden rounded-lg border">
                {STEPS.map((step) => (
                  <div
                    key={step}
                    className="flex h-12 items-end p-1"
                    style={{ background: `var(--color-${scale}-${step})` }}
                  >
                    <span
                      className={
                        step >= 500
                          ? "font-mono text-[10px] text-white"
                          : "font-mono text-[10px] text-neutral-950"
                      }
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Semantic tokens"
        description="Pairs that meet WCAG AA in light and dark mode."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SEMANTIC.map(([surface, text]) => (
            <div
              key={surface}
              className="rounded-lg border p-4"
              style={{
                background: `var(--${surface})`,
                color: `var(--${text})`,
              }}
            >
              <p className="text-sm font-medium">Aa</p>
              <p className="font-mono text-[11px]">{surface}</p>
              <p className="font-mono text-[11px]">{text}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {CHARTS.map((n) => (
            <div
              key={n}
              className="flex h-10 flex-1 items-center justify-center rounded-md font-mono text-xs text-white"
              style={{ background: `var(--chart-${n})` }}
            >
              chart-{n}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Typography"
        description="Lora for display, DM Sans for UI, IBM Plex Mono for code."
      >
        <div className="space-y-3 rounded-xl border bg-card p-6">
          <p className="font-serif text-4xl tracking-tight text-primary">
            Care that elevates
          </p>
          <p className="text-2xl font-semibold tracking-tight">
            Section heading
          </p>
          <p className="text-base">
            Body copy for members and experts. Keep sentences short and plain.
          </p>
          <p className="text-sm text-muted-foreground">Supporting text</p>
          <p className="font-mono text-sm">booking_id: 7f3c…</p>
        </div>
      </Section>

      <Section title="Buttons and badges">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Book a session</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Cancel booking</Button>
          <Button variant="link">Link</Button>
          <Button isDisabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </Section>

      <Section
        title="Feedback"
        description="Use toasts (sonner) for transient results; alerts for persistent page state."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Alert>
            <AlertTitle>Calendar connected</AlertTitle>
            <AlertDescription>
              New bookings will block your Google Calendar.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Payment failed</AlertTitle>
            <AlertDescription>
              The member&apos;s card was declined. No booking was created.
            </AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section
        title="Forms"
        description="Compose with Field / SettingsFieldset from @eleva/ui."
      >
        <div className="grid max-w-md gap-2">
          <Label htmlFor="ds-email">Email</Label>
          <Input id="ds-email" type="email" placeholder="you@example.com" />
        </div>
      </Section>

      <Section title="Stats">
        <StatGrid>
          <Stat
            label="Sessions this month"
            value="24"
            hint="+4 vs last month"
          />
          <Stat label="Revenue" value="€1,240" hint="Before platform fee" />
          <Stat label="Members" value="58" />
          <Stat label="Rating" value="4.9" hint="32 reviews" />
        </StatGrid>
      </Section>

      <Section title="Data table">
        <DataTableShell
          title="Recent payments"
          toolbar={
            <Button variant="outline" size="sm">
              Export
            </Button>
          }
          footer={<span>2 of 2 payments</span>}
        >
          <Table aria-label="Recent payments">
            <TableHeader>
              <TableHead isRowHeader>Member</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Amount</TableHead>
            </TableHeader>
            <TableBody>
              {SAMPLE_ROWS.map((row) => (
                <TableRow key={row.id} id={row.id}>
                  <TableCell>{row.member}</TableCell>
                  <TableCell>{row.service}</TableCell>
                  <TableCell>{row.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableShell>
      </Section>

      <Section title="Empty and loading states">
        <div className="grid gap-4 md:grid-cols-3">
          <EmptyState
            title="No services yet"
            description="Create your first service so members can book you."
            action={<Button size="sm">Create service</Button>}
          />
          <EmptyState
            variant="no-results"
            title="No matching sessions"
            description="Try a different date range."
          />
          <EmptyState
            variant="error"
            title="Couldn't load payments"
            description="Refresh the page or try again in a minute."
          />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Section>
    </main>
  )
}
