import { and, eq } from "drizzle-orm"
import { db } from "../client"
import * as main from "../schema/main"
import * as auth from "../schema/auth"

/**
 * Demo seed: one member (member.demo@example.test), one solo expert
 * (pat.mota@example.test / username 'patimota'), one clinic
 * (clinic.admin@example.test / slug 'clinicamota').
 *
 * Idempotent: repeated runs upsert on email / org slug.
 */

interface SeedPersona {
  email: string
  displayName: string
  orgType: "personal" | "expert" | "team"
  orgDisplayName: string
  orgSlug: string
  role: "owner" | "member"
}

const SEEDS: SeedPersona[] = [
  {
    email: "pat.mota@example.test",
    displayName: "Patricia Mota",
    orgType: "expert",
    orgDisplayName: "Patricia Mota (solo)",
    orgSlug: "patimota",
    role: "owner",
  },
  {
    email: "clinic.admin@example.test",
    displayName: "Clinic Admin",
    orgType: "team",
    orgDisplayName: "Clinica Mota",
    orgSlug: "clinicamota",
    role: "owner",
  },
  {
    email: "member.demo@example.test",
    displayName: "Demo Member",
    orgType: "personal",
    orgDisplayName: "Demo Member (personal)",
    orgSlug: "member-demo",
    role: "owner",
  },
]

async function upsertPersona(persona: SeedPersona) {
  const client = db()

  const [existingUser] = await client
    .select({ id: auth.user.id })
    .from(auth.user)
    .where(eq(auth.user.email, persona.email))
    .limit(1)

  let userId = existingUser?.id
  if (!userId) {
    const [inserted] = await client
      .insert(auth.user)
      .values({
        id: crypto.randomUUID(),
        name: persona.displayName,
        email: persona.email,
        emailVerified: true,
      })
      .returning({ id: auth.user.id })
    userId = inserted!.id
  }

  const [existingOrg] = await client
    .select({ id: auth.organization.id })
    .from(auth.organization)
    .where(eq(auth.organization.slug, persona.orgSlug))
    .limit(1)

  let orgId = existingOrg?.id
  if (!orgId) {
    const [inserted] = await client
      .insert(auth.organization)
      .values({
        id: crypto.randomUUID(),
        name: persona.orgDisplayName,
        slug: persona.orgSlug,
        type: persona.orgType,
      })
      .returning({ id: auth.organization.id })
    orgId = inserted!.id
  }

  const [existingMembership] = await client
    .select({ id: auth.member.id })
    .from(auth.member)
    .where(
      and(eq(auth.member.userId, userId), eq(auth.member.organizationId, orgId))
    )
    .limit(1)

  if (!existingMembership) {
    await client.insert(auth.member).values({
      id: crypto.randomUUID(),
      userId,
      organizationId: orgId,
      role: persona.role,
    })
  }

  return { userId, orgId }
}

async function upsertExpertProfile(args: {
  userId: string
  orgId: string
  username: string
  displayName: string
}) {
  const client = db()
  const [existing] = await client
    .select({ id: main.expertProfiles.id })
    .from(main.expertProfiles)
    .where(eq(main.expertProfiles.username, args.username))
    .limit(1)
  if (existing) return existing.id

  const [inserted] = await client
    .insert(main.expertProfiles)
    .values({
      orgId: args.orgId,
      userId: args.userId,
      username: args.username,
      displayName: args.displayName,
      headline: "Available for consultations on Eleva.",
      bio: "Demo seed profile. Replace with real bio in production.",
      languages: ["en", "pt"],
      practiceCountry: "PT",
      practiceCountries: ["PT"],
      serviceCountries: ["PT"],
      sessionModes: ["online"],
      status: "active",
    })
    .returning({ id: main.expertProfiles.id })
  return inserted!.id
}

async function upsertClinicProfile(args: {
  orgId: string
  slug: string
  displayName: string
}) {
  const client = db()
  const [existing] = await client
    .select({ id: main.clinicProfiles.id })
    .from(main.clinicProfiles)
    .where(eq(main.clinicProfiles.slug, args.slug))
    .limit(1)
  if (existing) return existing.id

  const [inserted] = await client
    .insert(main.clinicProfiles)
    .values({
      orgId: args.orgId,
      slug: args.slug,
      displayName: args.displayName,
      description:
        "Demo seed clinic. Replace with real description in production.",
      countryCode: "PT",
    })
    .returning({ id: main.clinicProfiles.id })
  return inserted!.id
}

export async function seedDemo() {
  const results: Array<{ email: string; userId: string; orgId: string }> = []
  for (const persona of SEEDS) {
    const { userId, orgId } = await upsertPersona(persona)
    results.push({ email: persona.email, userId, orgId })
  }

  const solo = results.find((r) => r.email === "pat.mota@example.test")
  if (solo) {
    await upsertExpertProfile({
      userId: solo.userId,
      orgId: solo.orgId,
      username: "patimota",
      displayName: "Patricia Mota",
    })
  }

  const clinic = results.find((r) => r.email === "clinic.admin@example.test")
  if (clinic) {
    await upsertClinicProfile({
      orgId: clinic.orgId,
      slug: "clinicamota",
      displayName: "Clinica Mota",
    })
  }

  return results
}
