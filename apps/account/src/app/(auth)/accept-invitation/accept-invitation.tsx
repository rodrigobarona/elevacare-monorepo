"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { authClient, type OrganizationInvitation } from "@eleva/auth/client"
import { BuildingsIcon, CheckCircleIcon, InfoIcon } from "@eleva/icons"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { AuthHeading, AuthStep } from "@/components/auth-ui"

type Invitation = OrganizationInvitation

type State =
  | { kind: "loading" }
  | { kind: "ready"; invitation: Invitation }
  | { kind: "accepted"; invitation: Invitation; switched: boolean }
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

/** Better Auth roles may be a list ("member,admin"). */
function isAdminRole(role: string): boolean {
  return role
    .split(",")
    .map((slug) => slug.trim())
    .some((slug) => slug === "admin" || slug === "owner")
}

/**
 * Accept or decline an organization invitation (Attio, Slack, hilos,
 * Craft): the clinic named in the heading and as a card, who invited her
 * and to which email, "Join" and "Decline" that mean what they say, a way
 * to decide later, and a joined state with one next step. Wrong account,
 * unverified email and used or expired invitations each say what to do.
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
  const [busy, setBusy] = useState<"accept" | "decline" | "switch" | null>(null)
  const [limitReached, setLimitReached] = useState(false)
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
    setLimitReached(false)
    const { error } = await authClient.organization.acceptInvitation({
      invitationId,
    })
    if (error) {
      setBusy(null)
      if (error.code === "ORGANIZATION_MEMBERSHIP_LIMIT_REACHED") {
        setLimitReached(true)
        return
      }
      setState(stateForError(error.code))
      return
    }
    // Open the clinic straight away when the switch works.
    const switched = await authClient.organization
      .setActive({ organizationId: invitation.organizationId })
      .then(({ error: switchError }) => !switchError)
      .catch(() => false)
    setBusy(null)
    setState({ kind: "accepted", invitation, switched })
  }

  async function decline(invitation: Invitation) {
    if (!invitationId) return
    setBusy("decline")
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

  /** Sign out, then sign in again and come straight back here. */
  async function switchAccount() {
    setBusy("switch")
    await authClient.signOut().catch(() => undefined)
    const back = `/accept-invitation?id=${encodeURIComponent(invitationId ?? "")}`
    window.location.assign(`/login?returnTo=${encodeURIComponent(back)}`)
  }

  if (state.kind === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("loading")}
      </p>
    )
  }

  const heading = (title: string, description?: string) => (
    <AuthHeading
      title={title}
      description={description}
      headingRef={headingRef}
      headingProps={{
        "data-testid": "invitation-heading",
        "data-state": state.kind,
      }}
    />
  )

  if (state.kind === "ready" || state.kind === "accepted") {
    const { invitation } = state
    const org = invitation.organizationName
    const accepted = state.kind === "accepted"
    return (
      <AuthStep data-testid="invitation">
        {heading(
          accepted ? t("joinedHeading", { org }) : t("heading", { org })
        )}
        <div className="flex items-center gap-4 rounded-3xl border bg-card p-5 shadow-1">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {accepted ? (
              <CheckCircleIcon aria-hidden className="size-6" weight="fill" />
            ) : (
              <BuildingsIcon aria-hidden className="size-6" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-medium">{org}</p>
            <p className="text-sm text-muted-foreground">
              {accepted
                ? t("joinedWith", { email: invitation.email })
                : t("invitedBy", { inviter: invitation.inviterEmail })}
            </p>
            {accepted ? null : (
              <p className="text-sm font-medium text-foreground">
                {isAdminRole(invitation.role)
                  ? t("roleAdmin")
                  : t("roleMember")}
              </p>
            )}
          </div>
        </div>
        {accepted ? (
          <>
            <p className="text-pretty text-muted-foreground">
              {state.switched
                ? t("joinedBody")
                : t("joinedBodyNoSwitch", { org })}
            </p>
            <LinkButton
              href="/dashboard"
              size="lg"
              className="min-h-12 self-start rounded-full px-6"
              data-testid="invitation-open"
            >
              {t("open", { org })}
            </LinkButton>
          </>
        ) : (
          <>
            <div className="space-y-2 text-pretty text-muted-foreground">
              <p>{t("sentTo", { email: invitation.email })}</p>
              <p>{t("whatJoining", { org })}</p>
            </div>
            {limitReached ? (
              <Alert variant="notice" role="alert">
                <InfoIcon aria-hidden />
                <AlertDescription className="text-foreground">
                  {t("limitReached", { org })}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="min-h-12 rounded-full px-6"
                data-testid="invitation-accept"
                isPending={busy === "accept"}
                isDisabled={busy !== null && busy !== "accept"}
                onPress={() => void accept(invitation)}
              >
                {busy === "accept" ? t("joining") : t("accept", { org })}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-12 rounded-full px-6"
                data-testid="invitation-decline"
                isPending={busy === "decline"}
                isDisabled={busy !== null && busy !== "decline"}
                onPress={() => void decline(invitation)}
              >
                {t("decline")}
              </Button>
              <a
                href="/dashboard"
                className="inline-flex min-h-11 items-center rounded-sm px-1 text-sm font-medium text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("decideLater")}
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("signedInAs", { email: signedInEmail })}{" "}
              <button
                type="button"
                onClick={() => void switchAccount()}
                className="inline-flex min-h-6 items-center rounded-sm font-medium text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("notYou")}
              </button>
            </p>
          </>
        )}
      </AuthStep>
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
    <AuthStep data-testid="invitation">
      {heading(message.title, message.body)}
      <div className="flex flex-wrap gap-3">
        {state.kind === "wrong-account" ? (
          <Button
            size="lg"
            className="min-h-12 rounded-full px-6"
            isPending={busy === "switch"}
            onPress={() => void switchAccount()}
          >
            {t("switchAccount")}
          </Button>
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
    </AuthStep>
  )
}
