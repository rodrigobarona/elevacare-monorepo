import { and, eq } from "drizzle-orm"
import { auth as authTables, db } from "@eleva/db"
import { capabilitiesFor, deriveProductLabel } from "../capabilities"
import {
  UnauthorizedError,
  type ApiAuthMode,
  type ElevaSession,
} from "../types"
import { getAuthApi } from "./auth"
import {
  bearerToken,
  isJwtBearer,
  listCredentialSources,
  SESSION_COOKIE_NAMES,
  countCookieValues,
} from "./credentials"
import { verifyBetterAuthJwt } from "./jwt-verify"

export type { ApiAuthMode }

export interface ApiIdentity extends ElevaSession {
  authMode: ApiAuthMode
}

export async function resolveApiAuth(request: Request): Promise<ApiIdentity> {
  const cookieHeader = request.headers.get("cookie") ?? ""
  for (const name of SESSION_COOKIE_NAMES) {
    if (countCookieValues(cookieHeader, name) > 1) {
      throw new UnauthorizedError(
        "ambiguous-credentials",
        "AMBIGUOUS_CREDENTIALS"
      )
    }
  }

  const sources = listCredentialSources(request)
  if (sources.length > 1) {
    throw new UnauthorizedError(
      "ambiguous-credentials",
      "AMBIGUOUS_CREDENTIALS"
    )
  }
  if (sources.length === 0) {
    throw new UnauthorizedError("no-session")
  }

  const source = sources[0]
  if (!source) throw new UnauthorizedError("no-session")
  switch (source) {
    case "cookie":
      return sessionFromCookieOrBearer(request, "cookie")
    case "api-key":
      return sessionFromApiKey(request)
    case "authorization": {
      const token = bearerToken(request)
      if (!token) throw new UnauthorizedError("no-session")
      if (isJwtBearer(token)) {
        return sessionFromJwt(token)
      }
      return sessionFromCookieOrBearer(request, "bearer")
    }
    default: {
      const _exhaustive: never = source
      throw new UnauthorizedError("no-session", String(_exhaustive))
    }
  }
}

export async function requireApiAuth(request: Request): Promise<ApiIdentity> {
  return resolveApiAuth(request)
}

/** Privileged mutations must not accept a non-revocable JWT. */
export async function requireRevocableApiAuth(
  request: Request
): Promise<ApiIdentity> {
  const identity = await requireApiAuth(request)
  if (identity.authMode === "jwt") {
    throw new UnauthorizedError(
      "jwt-not-revocable",
      "Privileged mutations require a cookie or opaque bearer session"
    )
  }
  return identity
}

async function sessionFromCookieOrBearer(
  request: Request,
  authMode: "cookie" | "bearer"
): Promise<ApiIdentity> {
  const result = await getAuthApi().getSession({
    headers: request.headers,
  })
  if (!result?.session || !result.user) {
    throw new UnauthorizedError("invalid-token")
  }

  const orgId =
    typeof result.session.activeOrganizationId === "string"
      ? result.session.activeOrganizationId
      : null

  return buildIdentity({
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
    image: result.user.image ?? null,
    orgId,
    authMode,
  })
}

async function sessionFromJwt(token: string): Promise<ApiIdentity> {
  let payload: Awaited<ReturnType<typeof verifyBetterAuthJwt>>
  try {
    payload = await verifyBetterAuthJwt(token)
  } catch {
    throw new UnauthorizedError("invalid-token")
  }

  const userId = typeof payload.sub === "string" ? payload.sub : null
  if (!userId) throw new UnauthorizedError("invalid-token")

  const orgId = typeof payload.orgId === "string" ? payload.orgId : null
  const email = typeof payload.email === "string" ? payload.email : ""
  const name = typeof payload.name === "string" ? payload.name : null

  return buildIdentity({
    userId,
    email,
    name,
    image: null,
    orgId,
    authMode: "jwt",
  })
}

async function sessionFromApiKey(request: Request): Promise<ApiIdentity> {
  const key = request.headers.get("x-api-key")?.trim()
  if (!key) throw new UnauthorizedError("no-session")

  const verified = await getAuthApi().verifyApiKey({
    body: { key },
  })
  if (!verified?.valid || !verified.key) {
    throw new UnauthorizedError("invalid-token")
  }

  const orgId = verified.key.referenceId ?? null
  return buildIdentity({
    userId: verified.key.userId,
    email: "",
    name: verified.key.name ?? null,
    image: null,
    orgId,
    authMode: "api-key",
  })
}

async function buildIdentity(input: {
  userId: string
  email: string
  name: string | null
  image: string | null
  orgId: string | null
  authMode: ApiAuthMode
}): Promise<ApiIdentity> {
  if (!input.orgId) {
    throw new UnauthorizedError("no-session", "active organization required")
  }

  const [membership] = await db()
    .select({
      role: authTables.member.role,
      orgType: authTables.organization.type,
      orgSlug: authTables.organization.slug,
    })
    .from(authTables.member)
    .innerJoin(
      authTables.organization,
      eq(authTables.member.organizationId, authTables.organization.id)
    )
    .where(
      and(
        eq(authTables.member.userId, input.userId),
        eq(authTables.member.organizationId, input.orgId)
      )
    )
    .limit(1)

  if (!membership) {
    throw new UnauthorizedError("no-session", "membership not found")
  }

  const orgType = membership.orgType as ElevaSession["orgType"]
  const workosRole =
    membership.role === "member" ? ("member" as const) : ("admin" as const)
  const productLabel = deriveProductLabel(
    orgType,
    membership.role === "owner" ? "owner" : workosRole
  )

  return {
    user: {
      id: input.userId,
      workosUserId: input.userId,
      email: input.email,
      displayName: input.name,
      avatarUrl: input.image,
    },
    orgId: input.orgId,
    workosOrgId: input.orgId,
    orgSlug: membership.orgSlug,
    productLabel,
    orgType,
    workosRole,
    authMode: input.authMode,
    capabilities: capabilitiesFor(productLabel),
  }
}
