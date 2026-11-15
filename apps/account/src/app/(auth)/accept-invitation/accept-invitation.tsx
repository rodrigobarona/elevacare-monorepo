"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { authClient, type OrganizationInvitation } from "@eleva/auth/client"
import { BuildingsIcon, CheckCircleIcon, InfoIcon } from "@eleva/icons"
import { Alert, AlertDescription, AlertTitle } from "@eleva/ui/components/alert"
import { Button, LinkButton } from "@eleva/ui/components/button"

type Invitation = OrganizationInvitation

type State =
  | { kind: "loading" }
  | { kind: "ready"; invitation: Invitation }
  | { kind: "accepted"; invitation: Invitation }
  | { kind: "declined"; invitation: Invitation }
  | { kind: "wrong-account" }
  | { kind: "verify-email" }
  | { kind: "unavailable" }

/** Better Auth error code → the state the member can act on. */
function stateForError(code: string | undefined): State {
  if (code === "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION") {
    return { kind: "wrong-account" }
  }
  if (code?.startsWith("EMAIL_VERIFICATION_REQUIRED")) {
    return { kind: "verify-email" }
  }
  return { kind: "unavailable" }
}

/** "a•••@clinic.pt": enough to recognise, not to read off a shared screen. */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@")
  if (!name || !domain) return email
  return `${name[0]}•••@${domain}`
}

/**
 * Accept or decline an organization invitation (Attio, Slack, hilos,
 * Craft): the clinic as a card, who invited her and to which email, one
 * clear "Join", an equally clear "Not now", and a joined state with one
 * next step. Wrong account, unverified email and used or expired
 * invitations each say what happened and what to do.
 */
export function AcceptInvitation({
  invitationId,
  signedInEmail,
}: {
  invitationId: string | null
  signedInEmail: string
}) {
  const t = useTranslations("invitation")
  const [state, setState] = useState<State>(
    invitationId ? { kind: "loading" } : { kind: "unavailable" }
  )
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)
  const [actionFailed, setActionFailed] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!invitationId) return
    let cancelled = false
    authClient.organization
      .getInvitation({ query: { id: invitationId } })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setState(stateForError(error?.code))
          return
        }
        setState({ kind: "ready", invitation: data })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "unavailable" })
      })
    return () => {
      cancelled = true
    }
  }, [invitationId])

  // Each new state is announced by moving focus to its heading.
  useEffect(() => {
    if (state.kind !== "loading") headingRef.current?.focus()
  }, [state.kind])

  async function accept(invitation: Invitation) {
    if (!invitationId) return
    setBusy("accept")
    setActionFailed(false)
    const { error } = await authClient.organization.acceptInvitation({
      invitationId,
    })
    if (error) {
      setBusy(null)
      if (error.code === "ORGANIZATION_MEMBERSHIP_LIMIT_REACHED") {
        setActionFailed(true)
        return
      }
      setState(stateForError(error.code))
      return
    }
    // Open the clinic straight away: it becomes the active organization.
    await authClient.organization
      .setActive({ organizationId: invitation.organizationId })
      .catch(() => undefined)
    setBusy(null)
    setState({ kind: "accepted", invitation })
  }

  async function decline(invitation: Invitation) {
    if (!invitationId) return
    setBusy("decline")
    setActionFailed(false)
    const { error } = await authClient.organization.rejectInvitation({
      invitationId,
    })
    setBusy(null)
    if (error) {
      setState(stateForError(error.code))
      return
    }
    setState({ kind: "declined", invitation })
  }

  if (state.kind === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("loading")}
      </p>
    )
  }

  const heading = (text: string) => (
    <h1
      ref={headingRef}
      tabIndex={-1}
      className="font-display text-3xl font-medium tracking-tight text-balance outline-none"
      data-testid="invitation-heading"
      data-state={state.kind}
    >
      {text}
    </h1>
  )

  if (state.kind === "ready" || state.kind === "accepted") {
    const { invitation } = state
    const role = invitation.role.includes("admin")
      ? t("roleAdmin")
      : t("roleMember")
    return (
      <div className="flex flex-col gap-6" data-testid="invitation">
        {heading(
          state.kind === "accepted"
            ? t("joinedHeading", { org: invitation.organizationName })
            : t("heading")
        )}
        <div className="flex items-center gap-4 rounded-3xl border bg-card p-5 shadow-1">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {state.kind === "accepted" ? (
              <CheckCircleIcon aria-hidden className="size-6" weight="fill" />
            ) : (
              <BuildingsIcon aria-hidden className="size-6" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-medium">
              {invitation.organizationName}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("invitedBy", { inviter: invitation.inviterEmail, role })}
            </p>
          </div>
        </div>
        {state.kind === "ready" ? (
          <>
            <p className="text-pretty text-muted-foreground">
              {t("sentTo", { email: maskEmail(invitation.email) })}{" "}
              {t("whatJoining")}
            </p>
            {actionFailed ? (
              <Alert variant="notice" role="alert">
                <InfoIcon aria-hidden />
                <AlertDescription className="text-foreground">
                  {t("limitReached", { org: invitation.organizationName })}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="min-h-12 rounded-full px-6"
                data-testid="invitation-accept"
                isDisabled={busy !== null}
                onPress={() => void accept(invitation)}
              >
                {busy === "accept"
                  ? t("joining")
                  : t("accept", { org: invitation.organizationName })}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-12 rounded-full px-6"
                data-testid="invitation-decline"
                isDisabled={busy !== null}
                onPress={() => void decline(invitation)}
              >
                {t("decline")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("signedInAs", { email: signedInEmail })}{" "}
              <a
                href="/logout"
                className="font-medium text-primary underline underline-offset-4"
              >
                {t("notYou")}
              </a>
            </p>
          </>
        ) : (
          <>
            <p className="text-pretty text-muted-foreground">
              {t("joinedBody")}
            </p>
            <LinkButton
              href="/dashboard"
              size="lg"
              className="min-h-12 self-start rounded-full px-6"
              data-testid="invitation-open"
            >
              {t("open", { org: invitation.organizationName })}
            </LinkButton>
          </>
        )}
      </div>
    )
  }

  const message =
    state.kind === "declined"
      ? {
          title: t("declinedHeading"),
          body: t("declinedBody", { org: state.invitation.organizationName }),
        }
      : state.kind === "wrong-account"
        ? {
            title: t("wrongAccountHeading"),
            body: t("wrongAccountBody", { email: signedInEmail }),
          }
        : state.kind === "verify-email"
          ? { title: t("verifyHeading"), body: t("verifyBody") }
          : { title: t("unavailableHeading"), body: t("unavailableBody") }

  return (
    <div className="flex flex-col gap-6" data-testid="invitation">
      {heading(message.title)}
      <Alert variant="notice">
        <InfoIcon aria-hidden />
        <AlertTitle className="sr-only">{message.title}</AlertTitle>
        <AlertDescription className="text-foreground">
          {message.body}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-3">
        {state.kind === "wrong-account" ? (
          <LinkButton
            href="/logout"
            size="lg"
            className="min-h-12 rounded-full px-6"
          >
            {t("switchAccount")}
          </LinkButton>
        ) : null}
        <LinkButton
          href="/dashboard"
          size="lg"
          variant={state.kind === "wrong-account" ? "outline" : "default"}
          className="min-h-12 rounded-full px-6"
        >
          {t("goToEleva")}
        </LinkButton>
      </div>
    </div>
  )
}
