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

function authBaseUrl(): string {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
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
    }) => Promise<{ error?: AuthClientError | null }>
    magicLink: (body: {
      email: string
      callbackURL?: string
    }) => Promise<{ error?: AuthClientError | null }>
    social: (body: {
      provider: string
      callbackURL?: string
    }) => Promise<unknown>
    passkey: () => Promise<{ error?: AuthClientError | null }>
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
    deletePasskey: (body: { id: string }) => Promise<unknown>
  }
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
  listSessions: () => Promise<{ data?: unknown }>
  revokeSession: (body: { token: string }) => Promise<unknown>
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
    twoFactorClient({ twoFactorPage: "/two-factor" }),
    passkeyClient(),
    magicLinkClient(),
    apiKeyClient(),
  ],
}) as unknown as ElevaAuthClient
