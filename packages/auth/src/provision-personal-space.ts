import { and, asc, eq, sql } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { auth, db } from "@eleva/db"

/**
 * Prefer the personal Space; otherwise the oldest membership. Used when minting
 * sessions after raw-SQL `provisionPersonalSpace` (which bypasses Better Auth's
 * createOrganization path that would set `activeOrganizationId`).
 */
export async function findDefaultOrganizationId(
  userId: string
): Promise<string | null> {
  const personal = await db()
    .select({ id: auth.organization.id })
    .from(auth.organization)
    .innerJoin(
      auth.member,
      eq(auth.member.organizationId, auth.organization.id)
    )
    .where(
      and(
        eq(auth.member.userId, userId),
        eq(auth.organization.type, "personal")
      )
    )
    .limit(1)

  if (personal[0]?.id) return personal[0].id

  const [first] = await db()
    .select({ id: auth.organization.id })
    .from(auth.organization)
    .innerJoin(
      auth.member,
      eq(auth.member.organizationId, auth.organization.id)
    )
    .where(eq(auth.member.userId, userId))
    .orderBy(asc(auth.member.createdAt))
    .limit(1)

  return first?.id ?? null
}

export async function provisionPersonalSpace(user: {
  id: string
  name?: string | null
}): Promise<void> {
  const existing = await db()
    .select({ id: auth.organization.id })
    .from(auth.organization)
    .innerJoin(
      auth.member,
      eq(auth.member.organizationId, auth.organization.id)
    )
    .where(
      and(
        eq(auth.member.userId, user.id),
        eq(auth.organization.type, "personal")
      )
    )
    .limit(1)

  if (existing[0]) return

  const firstName = (user.name ?? "Member").split(/\s+/)[0] ?? "Member"
  const name = `${firstName}'s Space`
  const orgId = crypto.randomUUID()
  const memberId = crypto.randomUUID()
  const slug = `space-${user.id.replaceAll("-", "").slice(0, 12)}`

  await withAudit({ orgId, actorUserId: user.id }, async (tx, ctx) => {
    await tx.execute(sql`
      insert into auth.organization (id, name, slug, type, created_at)
      values (${orgId}::uuid, ${name}, ${slug}, 'personal', now())
    `)
    await tx.execute(sql`
      insert into auth.member (id, organization_id, user_id, role, created_at)
      values (${memberId}::uuid, ${orgId}::uuid, ${user.id}::uuid, 'owner', now())
    `)
    await ctx.emit({
      entity: "organization",
      action: "created",
      entityId: orgId,
      payload: { type: "personal", name },
    })
  })
}
