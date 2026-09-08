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
}

export interface ElevaAuthClient {
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
    }) => Promise<unknown>
    passkey: (body?: {
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
  forgetPassword: (body: {
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
  }) => Promise<{ error?: AuthClientError | null }>
  linkSocial: (body: {
    provider: string
    callbackURL?: string
    scopes?: string[]
  }) => Promise<{
    data?: { url?: string; redirect?: boolean } | null
    error?: AuthClientError | null
  }>
  listSessions: () => Promise<{ data?: unknown }>
  revokeSession: (body: {
    token: string
  }) => Promise<{ error?: AuthClientError | null }>
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

export const CALENDAR_OAUTH_SCOPES = {
  google: [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ],
  microsoft: ["Calendars.ReadWrite", "offline_access"],
} as const
