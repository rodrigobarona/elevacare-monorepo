"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import { toast } from "sonner"
import { EnvelopeIcon, PlusIcon } from "@eleva/icons"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import { Button } from "@eleva/ui/components/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@eleva/ui/components/dialog"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { StatusPill } from "@eleva/ui/components/status-pill"
import {
  inviteMember,
  removeMember,
  withdrawInvitation,
  type InviteError,
  type RemoveError,
} from "./actions"

type MemberRole = "owner" | "admin" | "member"
type InviteRole = "admin" | "member"

export interface RosterMember {
  memberId: string
  userId: string
  name: string
  email: string
  image: string | null
  role: MemberRole
  publishedServices: number
}

export interface RosterInvitation {
  id: string
  email: string
  role: InviteRole
  expiresAt: string
  expired: boolean
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase() || "?"
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Errors about the address itself sit under the field; the rest above the buttons. */
const FIELD_ERRORS: readonly InviteError[] = ["validation", "already-member"]

/** Row buttons: a full-height target on a phone, compact from `sm` up. */
const ROW_BUTTON = "max-sm:h-10 max-sm:px-4"

export function TeamRoster({
  clinicName,
  currentUserId,
  seats,
  members,
  invitations,
}: {
  clinicName: string
  currentUserId: string
  /** Members with a published service, against what the plan includes. */
  seats: { used: number; cap: number }
  members: RosterMember[]
  invitations: RosterInvitation[]
}) {
  const t = useTranslations("members")
  const format = useFormatter()
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [removing, setRemoving] = React.useState<RosterMember | null>(null)
  const [removeError, setRemoveError] = React.useState<{
    error: RemoveError
    upcomingSessions?: number
  } | null>(null)
  const [busy, setBusy] = React.useState<{
    id: string
    kind: "resend" | "withdraw"
  } | null>(null)
  const [pending, startTransition] = React.useTransition()
  const peopleHeading = React.useRef<HTMLHeadingElement>(null)
  const invitedHeading = React.useRef<HTMLHeadingElement>(null)

  // Only the owner changes who administers the clinic.
  const viewerIsOwner =
    members.find((member) => member.userId === currentUserId)?.role === "owner"

  function resend(invitation: RosterInvitation) {
    setBusy({ id: invitation.id, kind: "resend" })
    startTransition(async () => {
      const result = await inviteMember({
        email: invitation.email,
        role: invitation.role,
      })
      setBusy(null)
      if (result.ok && result.emailSent) {
        toast.success(t("toast.resent", { email: invitation.email }))
      } else if (result.ok) {
        toast.error(t("toast.emailNotSent", { email: invitation.email }))
      } else {
        toast.error(t(`inviteError.${result.error}`))
      }
    })
  }

  function withdraw(invitation: RosterInvitation) {
    setBusy({ id: invitation.id, kind: "withdraw" })
    // The row is about to go: keep the keyboard's place on a heading.
    const nextFocus = invitations.length > 1 ? invitedHeading : peopleHeading
    startTransition(async () => {
      const result = await withdrawInvitation(invitation.id)
      setBusy(null)
      if (result.ok) {
        nextFocus.current?.focus()
        toast.success(t("toast.withdrawn", { email: invitation.email }))
      } else if (result.error === "gone") {
        nextFocus.current?.focus()
        toast.message(t("toast.invitationGone"))
      } else if (result.error === "owner-required") {
        toast.error(t("inviteError.owner-required"))
      } else {
        toast.error(t("toast.failed"))
      }
    })
  }

  function confirmRemove() {
    const member = removing
    if (!member) return
    startTransition(async () => {
      const result = await removeMember(member.memberId)
      if (result.ok || result.error === "gone") {
        setRemoving(null)
        setRemoveError(null)
        peopleHeading.current?.focus()
        if (result.ok) {
          toast.success(t("toast.removed", { name: member.name }))
        } else {
          toast.message(t("toast.memberGone"))
        }
        return
      }
      setRemoveError({
        error: result.error,
        upcomingSessions: result.upcomingSessions,
      })
    })
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="team-people" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="team-people"
            ref={peopleHeading}
            tabIndex={-1}
            className="rounded-sm text-lg font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {t("peopleHeading", { count: members.length })}
          </h2>
          <Button
            onPress={() => setInviteOpen(true)}
            data-testid="team-invite-open"
          >
            <PlusIcon data-icon="inline-start" />
            {t("invite.open")}
          </Button>
        </div>

        <ul
          className="divide-y rounded-2xl border bg-card"
          data-testid="team-people"
        >
          {members.map((member) => {
            const isYou = member.userId === currentUserId
            const canRemove =
              member.role !== "owner" &&
              !isYou &&
              (member.role !== "admin" || viewerIsOwner)
            const nameId = `team-member-name-${member.memberId}`
            return (
              <li
                key={member.memberId}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
                data-testid={`team-member-${member.memberId}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar size="lg">
                    {member.image ? (
                      <AvatarImage src={member.image} alt="" />
                    ) : null}
                    <AvatarFallback>{initials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-foreground">
                      <span id={nameId} className="truncate">
                        {member.name}
                      </span>
                      {isYou ? (
                        <span className="text-sm font-normal text-muted-foreground">
                          {t("you")}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t("services", { count: member.publishedServices })}
                    </p>
                    <StatusPill tone="neutral">
                      {t(`role.${member.role}`)}
                    </StatusPill>
                  </div>
                  {/* A fixed slot, so roles line up whether or not a row has an action. */}
                  <div className="flex shrink-0 justify-end sm:w-24">
                    {canRemove ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className={ROW_BUTTON}
                        onPress={() => {
                          setRemoveError(null)
                          setRemoving(member)
                        }}
                        aria-describedby={nameId}
                        data-testid={`team-member-remove-${member.memberId}`}
                      >
                        {t("remove.open")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <p
          className="max-w-prose text-sm text-muted-foreground"
          data-testid="team-seats"
        >
          {seats.used >= seats.cap ? t("seatsFull", seats) : t("seats", seats)}
        </p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("ownerNote")}
        </p>
      </section>

      {invitations.length > 0 ? (
        <section aria-labelledby="team-invited" className="space-y-4">
          <h2
            id="team-invited"
            ref={invitedHeading}
            tabIndex={-1}
            className="rounded-sm text-lg font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {t("invitedHeading", { count: invitations.length })}
          </h2>
          <ul
            className="divide-y rounded-2xl border bg-card"
            data-testid="team-invitations"
          >
            {invitations.map((invitation) => {
              const rowBusy = pending && busy?.id === invitation.id
              const canChange = invitation.role !== "admin" || viewerIsOwner
              const emailId = `team-invitation-email-${invitation.id}`
              const date = format.dateTime(new Date(invitation.expiresAt), {
                day: "numeric",
                month: "long",
              })
              return (
                <li
                  key={invitation.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
                  data-testid={`team-invitation-${invitation.id}`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    >
                      <EnvelopeIcon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p
                        id={emailId}
                        className="truncate font-medium text-foreground"
                      >
                        {invitation.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t(`role.${invitation.role}`)}
                        {" · "}
                        {invitation.expired
                          ? t("invitation.expired", { date })
                          : t("invitation.validUntil", { date })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {invitation.expired ? (
                      <StatusPill tone="attention">
                        {t("invitation.expiredPill")}
                      </StatusPill>
                    ) : null}
                    {canChange ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className={ROW_BUTTON}
                          isDisabled={pending}
                          onPress={() => resend(invitation)}
                          aria-describedby={emailId}
                          data-testid={`team-invitation-resend-${invitation.id}`}
                        >
                          {rowBusy && busy?.kind === "resend"
                            ? t("invitation.sending")
                            : t("invitation.resend")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={ROW_BUTTON}
                          isDisabled={pending}
                          onPress={() => withdraw(invitation)}
                          aria-describedby={emailId}
                          data-testid={`team-invitation-withdraw-${invitation.id}`}
                        >
                          {rowBusy && busy?.kind === "withdraw"
                            ? t("invitation.withdrawing")
                            : t("invitation.withdraw")}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <InviteDialog
        clinicName={clinicName}
        canInviteAdmin={viewerIsOwner}
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      <AlertDialog
        isOpen={removing !== null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setRemoving(null)
            setRemoveError(null)
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("remove.title", {
              name: removing?.name ?? "",
              clinic: clinicName,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("remove.body")}</AlertDialogDescription>
        </AlertDialogHeader>
        {removeError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription data-testid="team-member-remove-error">
              {removeError.error === "upcoming-sessions"
                ? t("remove.error.upcoming-sessions", {
                    name: removing?.name ?? "",
                    count: removeError.upcomingSessions ?? 1,
                  })
                : removeError.error === "pending-bookings"
                  ? t("remove.error.pending-bookings", {
                      name: removing?.name ?? "",
                    })
                  : t(`remove.error.${removeError.error}`)}
            </AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel isDisabled={pending} className="max-sm:h-10">
            {t("remove.cancel")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            className="max-sm:h-10"
            isDisabled={pending || removeError?.error === "upcoming-sessions"}
            onPress={confirmRemove}
            data-testid="team-member-remove-confirm"
          >
            {pending ? t("remove.working") : t("remove.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  )
}

function InviteDialog({
  clinicName,
  canInviteAdmin,
  isOpen,
  onClose,
}: {
  clinicName: string
  canInviteAdmin: boolean
  isOpen: boolean
  onClose: () => void
}) {
  const t = useTranslations("members")
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<InviteRole>("member")
  const [error, setError] = React.useState<InviteError | null>(null)
  const [pending, startTransition] = React.useTransition()
  const emailId = React.useId()
  const errorId = React.useId()
  const roleHelpId = React.useId()
  const fieldError = error !== null && FIELD_ERRORS.includes(error)

  function reset() {
    setEmail("")
    setRole("member")
    setError(null)
  }

  function close() {
    if (pending) return
    onClose()
    reset()
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const address = email.trim()
    if (!EMAIL_PATTERN.test(address)) {
      setError("validation")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await inviteMember({ email: address, role })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onClose()
      reset()
      if (!result.emailSent) {
        toast.error(t("toast.emailNotSent", { email: result.email }))
      } else if (result.resent) {
        toast.success(t("toast.resent", { email: result.email }))
      } else {
        toast.success(t("toast.invited", { email: result.email }))
      }
    })
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <form onSubmit={submit} className="grid gap-6" noValidate>
        <DialogHeader>
          <DialogTitle>{t("invite.title", { clinic: clinicName })}</DialogTitle>
          <DialogDescription>{t("invite.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={emailId}>{t("invite.email")}</Label>
            <Input
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(null)
              }}
              placeholder={t("invite.emailPlaceholder")}
              // The answer is about the address that was sent: keep it.
              readOnly={pending}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? errorId : undefined}
              data-testid="team-invite-email"
              autoFocus
            />
            {fieldError ? (
              <p
                id={errorId}
                role="alert"
                className="text-sm text-destructive"
                data-testid="team-invite-error"
              >
                {t(`inviteError.${error}`)}
              </p>
            ) : null}
          </div>
          {canInviteAdmin ? (
            <div className="space-y-1.5">
              <Select
                className="w-full"
                selectedKey={role}
                onSelectionChange={(key) => {
                  if (key === "admin" || key === "member") setRole(key)
                }}
                aria-describedby={roleHelpId}
              >
                <Label className="mb-1.5">{t("invite.role")}</Label>
                <SelectTrigger
                  className="w-full"
                  data-testid="team-invite-role"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem id="member" textValue={t("role.member")}>
                    {t("role.member")}
                  </SelectItem>
                  <SelectItem id="admin" textValue={t("role.admin")}>
                    {t("role.admin")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p id={roleHelpId} className="text-sm text-muted-foreground">
                {t(`invite.roleHelp.${role}`)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("invite.roleFixed")}
            </p>
          )}
        </div>
        {error && !fieldError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription data-testid="team-invite-error">
              {t(`inviteError.${error}`)}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="max-sm:h-10"
            onPress={close}
            isDisabled={pending}
          >
            {t("invite.cancel")}
          </Button>
          <Button
            type="submit"
            className="max-sm:h-10"
            isDisabled={pending}
            data-testid="team-invite-send"
          >
            {pending ? t("invite.sending") : t("invite.send")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
