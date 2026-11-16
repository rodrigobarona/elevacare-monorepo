"use client"

import { createAuthClient } from "better-auth/client"
import {
  adminClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins"
import { apiKeyClient } from "@better-auth/api-key/client"
import { passkeyClient } from "@better-auth/passkey/client"
import { ac, organizationRoles } from "./permissions"

export const MFA_RETURN_TO_STORAGE_KEY = "eleva.mfaReturnTo"

function authBaseUrl(): string {
  const api = process.env.NEXT_PUBLIC_API_URL
  if (!api) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_API_URL is required in production")
    }
    return "http://localhost:3002/auth"
  }
  return `${api.replace(/\/$/, "")}/auth`
}

interface AuthClientError {
  message?: string
  code?: string
  status?: number
}

export interface ElevaAuthClient {
  /** Ends the session on the auth server (`apps/api`) and clears its cookie. */
  signOut: () => Promise<{ error?: AuthClientError | null }>
  signIn: {
    email: (body: {
      email: string
      password: string
      callbackURL?: string
    }) => Promise<{
      data?: { twoFactorRedirect?: boolean } | null
      error?: AuthClientError | null
    }>
    magicLink: (body: {
      email: string
      callbackURL?: string
    }) => Promise<{ error?: AuthClientError | null }>
    social: (body: {
      provider: string
      callbackURL?: string
      errorCallbackURL?: string
    }) => Promise<unknown>
    passkey: (body?: {
      autoFill?: boolean
      fetchOptions?: { onSuccess?: () => void }
    }) => Promise<{ error?: AuthClientError | null }>
  }
  signUp: {
    email: (body: {
      email: string
      password: string
      name: string
      callbackURL?: string
    }) => Promise<{ error?: AuthClientError | null }>
  }
  twoFactor: {
    enable: (body: {
      password: string
    }) => Promise<{ data?: unknown; error?: AuthClientError | null }>
    verifyTotp: (body: {
      code: string
    }) => Promise<{ error?: AuthClientError | null }>
    verifyBackupCode: (body: {
      code: string
    }) => Promise<{ error?: AuthClientError | null }>
    disable: (body: {
      password: string
    }) => Promise<{ error?: AuthClientError | null }>
  }
  passkey: {
    listUserPasskeys: () => Promise<{ data?: unknown }>
    addPasskey: () => Promise<{ error?: AuthClientError | null }>
    deletePasskey: (body: {
      id: string
    }) => Promise<{ error?: AuthClientError | null }>
  }
  updateUser: (body: {
    name: string
  }) => Promise<{ error?: AuthClientError | null }>
  sendVerificationEmail: (body: {
    email: string
    callbackURL?: string
  }) => Promise<{ error?: AuthClientError | null }>
  requestPasswordReset: (body: {
    email: string
    redirectTo?: string
  }) => Promise<{ error?: AuthClientError | null }>
  resetPassword: (body: {
    newPassword: string
    token: string
  }) => Promise<{ error?: AuthClientError | null }>
  changePassword: (body: {
    currentPassword: string
    newPassword: string
    revokeOtherSessions?: boolean
  }) => Promise<{ error?: AuthClientError | null }>
  linkSocial: (body: {
    provider: string
    callbackURL?: string
    errorCallbackURL?: string
    scopes?: string[]
  }) => Promise<{
    data?: { url?: string; redirect?: boolean } | null
    error?: AuthClientError | null
  }>
  listAccounts: () => Promise<{
    data?: Array<{ id: string; providerId: string }> | null
    error?: AuthClientError | null
  }>
  /** The signed-in session (its token marks "this device" in a list). */
  getSession: () => Promise<{
    data?: {
      session: { id: string; token: string }
      user: { twoFactorEnabled?: boolean | null }
    } | null
    error?: AuthClientError | null
  }>
  listSessions: () => Promise<{ data?: unknown }>
  revokeSession: (body: {
    token: string
  }) => Promise<{ error?: AuthClientError | null }>
  revokeOtherSessions: () => Promise<{ error?: AuthClientError | null }>
  /** Organization invitations (Better Auth organization plugin). */
  organization: {
    getInvitation: (input: { query: { id: string } }) => Promise<{
      data?: OrganizationInvitation | null
      error?: AuthClientError | null
    }>
    acceptInvitation: (body: {
      invitationId: string
    }) => Promise<{ error?: AuthClientError | null }>
    rejectInvitation: (body: {
      invitationId: string
    }) => Promise<{ error?: AuthClientError | null }>
    setActive: (body: {
      organizationId: string
    }) => Promise<{ error?: AuthClientError | null }>
  }
}

/** What `getInvitation` returns: the invitation plus who and where. */
export type OrganizationInvitation = {
  id: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  inviterEmail: string
  email: string
  role: string
  status: string
  expiresAt: string | Date
}

export const authClient = createAuthClient({
  baseURL: authBaseUrl(),
  fetchOptions: { credentials: "include" },
  plugins: [
    organizationClient({
      ac,
      roles: organizationRoles,
    }),
    adminClient(),
    twoFactorClient({
      twoFactorPage: "/two-factor",
      onTwoFactorRedirect() {
        const returnTo =
          typeof sessionStorage === "undefined"
            ? null
            : sessionStorage.getItem(MFA_RETURN_TO_STORAGE_KEY)
        const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""
        window.location.assign(`/two-factor${qs}`)
      },
    }),
    passkeyClient(),
    magicLinkClient(),
    apiKeyClient(),
  ],
}) as unknown as ElevaAuthClient

/**
 * The narrowest Google scopes that cover what Eleva does: list the
 * calendars, read busy times only (never what is inside an event), and
 * manage the session events on calendars the expert owns. The first two
 * are non-sensitive; `calendar.events.owned` is the one Google reviews.
 */
export const CALENDAR_OAUTH_SCOPES = {
  google: [
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events.freebusy",
    "https://www.googleapis.com/auth/calendar.events.owned",
  ],
  microsoft: ["Calendars.ReadWrite", "offline_access"],
} as const
