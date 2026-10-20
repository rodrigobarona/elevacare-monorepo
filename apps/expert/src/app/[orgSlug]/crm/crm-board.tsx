"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  createApiClient,
  type CrmContactListItem,
  type CrmFollowUp,
  type CrmFollowUpKind,
  type CrmLifecycleStage,
} from "@eleva/api-client"
import { AddressBookIcon } from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@eleva/ui/components/sheet"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { Tabs, TabsList, TabsTrigger } from "@eleva/ui/components/tabs"
import { Textarea } from "@eleva/ui/components/textarea"

const STAGES: readonly CrmLifecycleStage[] = [
  "lead",
  "active",
  "dormant",
  "churned",
]
const KINDS: readonly CrmFollowUpKind[] = ["call", "message", "review"]

type LeadDraft = { name: string; email: string; phone: string }

const EMPTY_LEAD: LeadDraft = { name: "", email: "", phone: "" }
type FollowUpDraft = { date: string; kind: CrmFollowUpKind; note: string }

function contactKey(item: CrmContactListItem): string {
  return item.id ?? item.memberUserId ?? `guest:${item.email ?? item.name}`
}

function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ].slice(0, 10)
}

function tomorrow(): string {
  const date = new Date(Date.now() + 86_400_000)
  return date.toISOString().slice(0, 10)
}

export function CrmBoard({
  apiBaseUrl,
  membersPath,
}: {
  apiBaseUrl: string
  membersPath: string
}) {
  const t = useTranslations("crm")
  const format = useFormatter()
  const api = useMemo(
    () => createApiClient({ baseUrl: apiBaseUrl }),
    [apiBaseUrl]
  )
  const [contacts, setContacts] = useState<CrmContactListItem[]>([])
  const [followUps, setFollowUps] = useState<CrmFollowUp[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<string>("all")
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [isDrawerOpen, setDrawerOpen] = useState(false)
  const [tagsDraft, setTagsDraft] = useState("")
  const [followUpDraft, setFollowUpDraft] = useState<FollowUpDraft>({
    date: tomorrow(),
    kind: "call",
    note: "",
  })
  const [lead, setLead] = useState<LeadDraft>(EMPTY_LEAD)
  const [isLeadOpen, setLeadOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    Promise.all([api.crm.listContacts(), api.crm.listFollowUps()])
      .then(([contactList, followUpList]) => {
        if (cancelled) return
        setContacts(contactList.contacts)
        setFollowUps(followUpList.followUps)
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setLoaded(true)
        toast.error(t("loadFailed"))
      })
    return () => {
      cancelled = true
    }
  }, [api, t])

  const visible =
    filter === "all"
      ? contacts
      : contacts.filter((c) => c.lifecycleStage === filter)
  const selected = contacts.find((c) => contactKey(c) === openKey) ?? null
  const selectedFollowUps = selected?.id
    ? followUps.filter((f) => f.contactId === selected.id)
    : []
  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium" })

  function replaceContact(
    previousKey: string,
    patch: Partial<CrmContactListItem>
  ) {
    const nextKey = patch.id ?? previousKey
    setContacts((list) =>
      list.map((item) =>
        contactKey(item) === previousKey ? { ...item, ...patch } : item
      )
    )
    setOpenKey((key) => (key === previousKey ? nextKey : key))
  }

  function openContact(item: CrmContactListItem) {
    setTagsDraft(item.tags.join(", "))
    setFollowUpDraft({ date: tomorrow(), kind: "call", note: "" })
    setOpenKey(contactKey(item))
    setDrawerOpen(true)
  }

  /** Members get their CRM row on the first stage, tag or follow-up. */
  async function ensureContactId(item: CrmContactListItem): Promise<string> {
    if (item.id) return item.id
    const created = await api.crm.createContact({
      memberUserId: item.memberUserId!,
    })
    replaceContact(contactKey(item), { id: created.id })
    return created.id
  }

  function save(
    item: CrmContactListItem,
    patch: { lifecycleStage?: CrmLifecycleStage; tags?: string[] }
  ) {
    startTransition(async () => {
      try {
        const id = await ensureContactId(item)
        const updated = await api.crm.updateContact(id, patch)
        replaceContact(contactKey({ ...item, id }), {
          id,
          lifecycleStage: updated.lifecycleStage,
          tags: updated.tags,
        })
        toast.success(t("saved"))
      } catch {
        toast.error(t("saveFailed"))
      }
    })
  }

  function addFollowUp(item: CrmContactListItem) {
    const draft = followUpDraft
    startTransition(async () => {
      try {
        const contactId = await ensureContactId(item)
        const created = await api.crm.createFollowUp({
          contactId,
          dueAt: new Date(`${draft.date}T09:00:00`).toISOString(),
          kind: draft.kind,
          ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
        })
        setFollowUps((list) =>
          [...list, created].sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        )
        replaceContact(contactKey({ ...item, id: contactId }), {
          openFollowUps: item.openFollowUps + 1,
        })
        setFollowUpDraft({ date: tomorrow(), kind: "call", note: "" })
        toast.success(t("followUpAdded"))
      } catch {
        toast.error(t("saveFailed"))
      }
    })
  }

  function complete(followUp: CrmFollowUp) {
    startTransition(async () => {
      try {
        await api.crm.completeFollowUp(followUp.id)
        setFollowUps((list) => list.filter((f) => f.id !== followUp.id))
        setContacts((list) =>
          list.map((item) =>
            item.id === followUp.contactId
              ? { ...item, openFollowUps: Math.max(0, item.openFollowUps - 1) }
              : item
          )
        )
        toast.success(t("followUpDone"))
      } catch {
        toast.error(t("saveFailed"))
      }
    })
  }

  function createLead() {
    const draft = lead
    startTransition(async () => {
      try {
        const created = await api.crm.createContact({
          name: draft.name.trim(),
          ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
          ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
        })
        setContacts((list) => [
          {
            id: created.id,
            source: "lead",
            memberUserId: null,
            name: created.name,
            email: created.email,
            phone: created.phone,
            lifecycleStage: created.lifecycleStage,
            tags: created.tags,
            sessionCount: 0,
            lastSessionAt: null,
            nextSessionAt: null,
            openFollowUps: 0,
          },
          ...list,
        ])
        setLeadOpen(false)
        toast.success(t("leadAdded"))
      } catch {
        toast.error(t("saveFailed"))
      }
    })
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("dueTitle")}</h2>
        {!loaded ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dueEmpty")}</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-1">
            {followUps.map((followUp) => (
              <li
                key={followUp.id}
                className="flex flex-wrap items-center gap-3 p-4 sm:px-6"
                data-testid="crm-follow-up-row"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">
                    {followUp.contactName ?? t("unnamed")}
                  </p>
                  {followUp.note ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {followUp.note}
                    </p>
                  ) : null}
                </div>
                <StatusPill tone="neutral">
                  {t(`kind.${followUp.kind}`)}
                </StatusPill>
                <StatusPill
                  tone={
                    new Date(followUp.dueAt).getTime() < now
                      ? "attention"
                      : "neutral"
                  }
                >
                  {t("dueOn", { date: date(followUp.dueAt) })}
                </StatusPill>
                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={isPending}
                  onPress={() => complete(followUp)}
                >
                  {t("markDone")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            selectedKey={filter}
            onSelectionChange={(key) => setFilter(String(key))}
          >
            <TabsList variant="line" className="flex-wrap">
              <TabsTrigger id="all">{t("filterAll")}</TabsTrigger>
              {STAGES.map((stage) => (
                <TabsTrigger key={stage} id={stage}>
                  {t(`stage.${stage}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            onPress={() => {
              setLead(EMPTY_LEAD)
              setLeadOpen(true)
            }}
          >
            {t("addLead")}
          </Button>
        </div>

        {!loaded ? null : visible.length === 0 ? (
          <EmptyState
            icon={<AddressBookIcon />}
            title={t("emptyTitle")}
            description={t("emptyBody")}
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-1">
            {visible.map((item) => (
              <li key={contactKey(item)} data-testid="crm-contact-row">
                <button
                  type="button"
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50 sm:px-6"
                  onClick={() => openContact(item)}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium">
                      {item.name ?? t("unnamed")}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {item.source === "lead"
                        ? t("sourceLead")
                        : t("sessionCount", { count: item.sessionCount })}
                      {item.tags.length > 0 ? ` · ${item.tags.join(", ")}` : ""}
                    </p>
                  </div>
                  {item.openFollowUps > 0 ? (
                    <StatusPill tone="attention">
                      {t("openCount", { count: item.openFollowUps })}
                    </StatusPill>
                  ) : null}
                  <StatusPill
                    tone={
                      item.lifecycleStage === "active" ? "positive" : "neutral"
                    }
                  >
                    {t(`stage.${item.lifecycleStage}`)}
                  </StatusPill>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet
        isOpen={isDrawerOpen && selected !== null}
        onOpenChange={setDrawerOpen}
        side="right"
        className="w-full sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>{selected?.name ?? t("unnamed")}</SheetTitle>
          <SheetDescription>
            {selected
              ? [selected.email, selected.phone].filter(Boolean).join(" · ")
              : null}
          </SheetDescription>
        </SheetHeader>
        {selected ? (
          <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
            {selected.source === "guest" ? (
              <p className="text-sm text-muted-foreground">{t("guestHint")}</p>
            ) : (
              <>
                {selected.memberUserId ? (
                  <LinkButton
                    variant="outline"
                    size="sm"
                    href={`${membersPath}/${selected.memberUserId}`}
                  >
                    {t("viewSessions")}
                  </LinkButton>
                ) : null}
                <div className="space-y-2">
                  <Label>{t("stageLabel")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {STAGES.map((stage) => (
                      <Button
                        key={stage}
                        size="sm"
                        isDisabled={isPending}
                        variant={
                          selected.lifecycleStage === stage
                            ? "secondary"
                            : "outline"
                        }
                        onPress={() =>
                          save(selected, { lifecycleStage: stage })
                        }
                      >
                        {t(`stage.${stage}`)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crm-tags">{t("tagsLabel")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="crm-tags"
                      value={tagsDraft}
                      placeholder={t("tagsPlaceholder")}
                      onChange={(e) => setTagsDraft(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      isDisabled={isPending}
                      onPress={() =>
                        save(selected, { tags: parseTags(tagsDraft) })
                      }
                    >
                      {t("saveTags")}
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-medium">{t("followUpsTitle")}</h3>
                  {selectedFollowUps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("followUpsEmpty")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedFollowUps.map((followUp) => (
                        <li
                          key={followUp.id}
                          className="flex items-center gap-3 rounded-2xl border p-3"
                        >
                          <div className="min-w-0 flex-1 text-sm">
                            <p className="font-medium">
                              {t(`kind.${followUp.kind}`)} ·{" "}
                              {date(followUp.dueAt)}
                            </p>
                            {followUp.note ? (
                              <p className="text-muted-foreground">
                                {followUp.note}
                              </p>
                            ) : null}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            isDisabled={isPending}
                            onPress={() => complete(followUp)}
                          >
                            {t("markDone")}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="space-y-3 rounded-2xl border border-dashed p-3">
                    <div className="flex flex-wrap gap-2">
                      {KINDS.map((kind) => (
                        <Button
                          key={kind}
                          size="sm"
                          variant={
                            followUpDraft.kind === kind
                              ? "secondary"
                              : "outline"
                          }
                          onPress={() =>
                            setFollowUpDraft((draft) => ({ ...draft, kind }))
                          }
                        >
                          {t(`kind.${kind}`)}
                        </Button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crm-due">{t("dueLabel")}</Label>
                      <Input
                        id="crm-due"
                        type="date"
                        value={followUpDraft.date}
                        onChange={(e) => {
                          const date = e.target.value
                          setFollowUpDraft((draft) => ({ ...draft, date }))
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crm-note">{t("noteLabel")}</Label>
                      <Textarea
                        id="crm-note"
                        value={followUpDraft.note}
                        maxLength={2000}
                        onChange={(e) => {
                          const note = e.target.value
                          setFollowUpDraft((draft) => ({ ...draft, note }))
                        }}
                      />
                    </div>
                    <Button
                      size="sm"
                      isDisabled={isPending || !followUpDraft.date}
                      onPress={() => addFollowUp(selected)}
                    >
                      {t("addFollowUp")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Sheet>

      <Sheet
        isOpen={isLeadOpen}
        onOpenChange={setLeadOpen}
        side="right"
        className="w-full sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>{t("addLead")}</SheetTitle>
          <SheetDescription>{t("leadHint")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="lead-name">{t("nameLabel")}</Label>
            <Input
              id="lead-name"
              value={lead.name}
              maxLength={200}
              onChange={(e) => {
                const name = e.target.value
                setLead((current) => ({ ...current, name }))
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-email">{t("emailLabel")}</Label>
            <Input
              id="lead-email"
              type="email"
              value={lead.email}
              maxLength={320}
              onChange={(e) => {
                const email = e.target.value
                setLead((current) => ({ ...current, email }))
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-phone">{t("phoneLabel")}</Label>
            <Input
              id="lead-phone"
              type="tel"
              value={lead.phone}
              maxLength={32}
              onChange={(e) => {
                const phone = e.target.value
                setLead((current) => ({ ...current, phone }))
              }}
            />
          </div>
        </div>
        <SheetFooter>
          <Button
            isDisabled={isPending || !lead.name.trim()}
            onPress={createLead}
          >
            {t("saveLead")}
          </Button>
        </SheetFooter>
      </Sheet>
    </div>
  )
}
