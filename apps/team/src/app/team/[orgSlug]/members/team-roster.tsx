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
  invitedByName: string | null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase() || "?"
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function TeamRoster({
  clinicName,
  currentUserId,
  members,
  invitations,
}: {
  clinicName: string
  currentUserId: string
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
  const [busyInvitation, setBusyInvitation] = React.useState<string | null>(
    null
  )
  const [pending, startTransition] = React.useTransition()

  function resend(invitation: RosterInvitation) {
    setBusyInvitation(invitation.id)
    startTransition(async () => {
      const result = await inviteMember({
        email: invitation.email,
        role: invitation.role,
      })
      setBusyInvitation(null)
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
    setBusyInvitation(invitation.id)
    startTransition(async () => {
      const result = await withdrawInvitation(invitation.id)
      setBusyInvitation(null)
      if (result.ok) {
        toast.success(t("toast.withdrawn", { email: invitation.email }))
      } else if (result.error === "gone") {
        toast.message(t("toast.invitationGone"))
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
      if (result.ok) {
        setRemoving(null)
        setRemoveError(null)
        toast.success(t("toast.removed", { name: member.name }))
        return
      }
      if (result.error === "gone") {
        setRemoving(null)
        setRemoveError(null)
        toast.message(t("toast.memberGone"))
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
          <h2 id="team-people" className="text-lg font-medium text-foreground">
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
            const canRemove = member.role !== "owner" && !isYou
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
                      <span className="truncate">{member.name}</span>
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
                  {canRemove ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        setRemoveError(null)
                        setRemoving(member)
                      }}
                      aria-label={t("remove.openLabel", { name: member.name })}
                      data-testid={`team-member-remove-${member.memberId}`}
                    >
                      {t("remove.open")}
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="text-sm text-muted-foreground">{t("ownerNote")}</p>
      </section>

      {invitations.length > 0 ? (
        <section aria-labelledby="team-invited" className="space-y-4">
          <h2 id="team-invited" className="text-lg font-medium text-foreground">
            {t("invitedHeading", { count: invitations.length })}
          </h2>
          <ul
            className="divide-y rounded-2xl border bg-card"
            data-testid="team-invitations"
          >
            {invitations.map((invitation) => {
              const busy = pending && busyInvitation === invitation.id
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
                      <p className="truncate font-medium text-foreground">
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
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={pending}
                      onPress={() => resend(invitation)}
                      aria-label={t("invitation.resendLabel", {
                        email: invitation.email,
                      })}
                    >
                      {busy ? t("invitation.working") : t("invitation.resend")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      isDisabled={pending}
                      onPress={() => withdraw(invitation)}
                      aria-label={t("invitation.withdrawLabel", {
                        email: invitation.email,
                      })}
                    >
                      {t("invitation.withdraw")}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <InviteDialog
        clinicName={clinicName}
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
            <AlertDescription>
              {removeError.error === "upcoming-sessions"
                ? t("remove.error.upcoming-sessions", {
                    name: removing?.name ?? "",
                    count: removeError.upcomingSessions ?? 1,
                  })
                : t(`remove.error.${removeError.error}`)}
            </AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel isDisabled={pending}>
            {t("remove.cancel")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
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
  isOpen,
  onClose,
}: {
  clinicName: string
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

  function close() {
    if (pending) return
    onClose()
    setEmail("")
    setRole("member")
    setError(null)
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
      setEmail("")
      setRole("member")
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
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              data-testid="team-invite-email"
              autoFocus
            />
            {error ? (
              <p id={errorId} role="alert" className="text-sm text-destructive">
                {t(`inviteError.${error}`)}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Select
              selectedKey={role}
              onSelectionChange={(key) => {
                if (key === "admin" || key === "member") setRole(key)
              }}
            >
              <Label className="mb-1.5">{t("invite.role")}</Label>
              <SelectTrigger className="w-full" data-testid="team-invite-role">
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
            <p className="text-sm text-muted-foreground">
              {t(`invite.roleHelp.${role}`)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onPress={close}
            isDisabled={pending}
          >
            {t("invite.cancel")}
          </Button>
          <Button
            type="submit"
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
