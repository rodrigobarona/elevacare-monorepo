import { and, eq } from "drizzle-orm"
import { auth as authTables, db } from "@eleva/db"
import {
  capabilitiesFor,
  deriveProductLabel,
  normalizeMembershipRole,
  toMembershipSeniority,
} from "../capabilities"
import { findDefaultOrganizationId } from "../provision-personal-space"
import {
  UnauthorizedError,
  type ApiAuthMode,
  type ElevaSession,
} from "../types"
import { getAuthApi } from "./auth"
import {
  bearerToken,
  ELEVA_ORG_HEADER,
  hasDuplicateSessionCookie,
  isJwtBearer,
  listCredentialSources,
} from "./credentials"
import { assertCookieCsrf } from "./csrf"
import { verifyBetterAuthJwt } from "./jwt-verify"

export type { ApiAuthMode }
export { expiredSessionCookies } from "./credentials"

export interface ApiIdentity extends ElevaSession {
  authMode: ApiAuthMode
}

export async function resolveApiAuth(request: Request): Promise<ApiIdentity> {
  if (hasDuplicateSessionCookie(request.headers.get("cookie"))) {
    throw new UnauthorizedError(
      "session-cookie-ambiguous",
      "SESSION_COOKIE_AMBIGUOUS"
    )
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
      assertCookieCsrf(request)
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

export interface ApiUserIdentity {
  user: ElevaSession["user"]
  /** The session's active organization, if any; may be stale. */
  activeOrgId: string | null
  authMode: "cookie" | "bearer"
}

/**
 * A signed-in person, with or without an organization membership. Only for
 * onboarding, where someone without a Space yet must be able to create one;
 * every other route needs `requireApiAuth`. Accepts revocable credentials
 * only (session cookie or opaque bearer), never a JWT or an API key.
 */
export async function requireApiUser(
  request: Request
): Promise<ApiUserIdentity> {
  if (hasDuplicateSessionCookie(request.headers.get("cookie"))) {
    throw new UnauthorizedError(
      "session-cookie-ambiguous",
      "SESSION_COOKIE_AMBIGUOUS"
    )
  }
  const sources = listCredentialSources(request)
  if (sources.length > 1) {
    throw new UnauthorizedError(
      "ambiguous-credentials",
      "AMBIGUOUS_CREDENTIALS"
    )
  }
  const source = sources[0]
  if (!source) throw new UnauthorizedError("no-session")

  let authMode: ApiUserIdentity["authMode"]
  if (source === "cookie") {
    assertCookieCsrf(request)
    authMode = "cookie"
  } else if (source === "authorization") {
    const token = bearerToken(request)
    if (!token) throw new UnauthorizedError("no-session")
    if (isJwtBearer(token)) {
      throw new UnauthorizedError(
        "jwt-not-revocable",
        "Onboarding requires a cookie or opaque bearer session"
      )
    }
    authMode = "bearer"
  } else {
    throw new UnauthorizedError(
      "missing-capability",
      "Onboarding requires a person's session, not an API key"
    )
  }

  const result = await getAuthApi().getSession({ headers: request.headers })
  if (!result?.session || !result.user) {
    throw new UnauthorizedError("invalid-token")
  }
  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      displayName: result.user.name,
      avatarUrl: result.user.image ?? null,
    },
    activeOrgId:
      typeof result.session.activeOrganizationId === "string"
        ? result.session.activeOrganizationId
        : null,
    authMode,
  }
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

  const activeOrgId =
    typeof result.session.activeOrganizationId === "string"
      ? result.session.activeOrganizationId
      : null
  // A page that names its workspace (the org slug in its address) wins over
  // the session's active workspace, which can lag behind a switch.
  const namedSlug = request.headers.get(ELEVA_ORG_HEADER)?.trim() || null
  const orgId = namedSlug
    ? await membershipOrgIdBySlug(result.user.id, namedSlug)
    : activeOrgId

  return buildIdentity({
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
    image: result.user.image ?? null,
    orgId,
    authMode,
  })
}

/** The org the person belongs to under this slug, or `not-a-member`. */
async function membershipOrgIdBySlug(
  userId: string,
  slug: string
): Promise<string> {
  const [row] = await db()
    .select({ orgId: authTables.organization.id })
    .from(authTables.member)
    .innerJoin(
      authTables.organization,
      eq(authTables.member.organizationId, authTables.organization.id)
    )
    .where(
      and(
        eq(authTables.member.userId, userId),
        eq(authTables.organization.slug, slug)
      )
    )
    .limit(1)
  if (!row) {
    throw new UnauthorizedError("not-a-member", "membership not found")
  }
  return row.orgId
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
  // Match loadElevaSession: when the cookie has no activeOrganizationId
  // (legacy sessions minted before the session.create hook), prefer the
  // personal Space / first membership instead of 401 no-session.
  const orgId = input.orgId ?? (await findDefaultOrganizationId(input.userId))
  if (!orgId) {
    throw new UnauthorizedError("no-session", "active organization required")
  }

  const [membership] = await db()
    .select({
      role: authTables.member.role,
      orgType: authTables.organization.type,
      orgSlug: authTables.organization.slug,
      orgId: authTables.organization.id,
    })
    .from(authTables.member)
    .innerJoin(
      authTables.organization,
      eq(authTables.member.organizationId, authTables.organization.id)
    )
    .where(
      and(
        eq(authTables.member.userId, input.userId),
        eq(authTables.member.organizationId, orgId)
      )
    )
    .limit(1)

  if (!membership) {
    throw new UnauthorizedError("not-a-member", "membership not found")
  }

  const orgType = membership.orgType as ElevaSession["orgType"]
  const seniority = toMembershipSeniority(membership.role)
  const membershipRole = normalizeMembershipRole(seniority)
  const productLabel = deriveProductLabel(orgType, seniority)

  return {
    user: {
      id: input.userId,
      email: input.email,
      displayName: input.name,
      avatarUrl: input.image,
    },
    orgId: membership.orgId,
    orgSlug: membership.orgSlug,
    productLabel,
    orgType,
    membershipRole,
    authMode: input.authMode,
    capabilities: capabilitiesFor(productLabel),
  }
}
