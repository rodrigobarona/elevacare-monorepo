import { and, eq } from "drizzle-orm"
import { db } from "../client"
import * as main from "../schema/main"

/**
 * Demo seed: one patient (patient.demo@example.test), one solo expert
 * (pat.mota@example.test / username 'patimota'), one clinic
 * (clinic.admin@example.test / slug 'clinicamota') plus a second
 * expert membership of the clinic admin (clinic+admin).
 *
 * Idempotent: repeated runs upsert on workos_user_id / workos_org_id.
 *
 * Called from `pnpm --filter=@eleva/db db:seed -- --demo`. WorkOS ids
 * are synthesised (dev_*) because the seed does NOT create real WorkOS
 * records \u2014 that lands in S1-B.1 sign-up flow. The seed only populates
 * Eleva DB for local UI rendering + integration tests.
 *
 * S2 update: this seed now also writes a minimum expert_profiles +
 * clinic_profiles row so /[username] resolution and the explorer
 * have something to render. Categories must be seeded separately via
 * `pnpm --filter=@eleva/db db:seed:categories` before the listing
 * insert can resolve a category slug.
 */

interface SeedPersona {
  workosUserId: string
  workosOrgId: string
  email: string
  displayName: string
  orgType: "personal" | "solo_expert" | "clinic"
  orgDisplayName: string
  workosRole: "admin" | "member"
}

const SEEDS: SeedPersona[] = [
  {
    workosUserId: "dev_user_patricia_mota",
    workosOrgId: "dev_org_patricia_mota_solo",
    email: "pat.mota@example.test",
    displayName: "Patricia Mota",
    orgType: "solo_expert",
    orgDisplayName: "Patricia Mota (solo)",
    workosRole: "admin",
  },
  {
    workosUserId: "dev_user_clinic_admin",
    workosOrgId: "dev_org_clinica_mota",
    email: "clinic.admin@example.test",
    displayName: "Clinic Admin",
    orgType: "clinic",
    orgDisplayName: "Clinica Mota",
    workosRole: "admin",
  },
  {
    workosUserId: "dev_user_patient_demo",
    workosOrgId: "dev_org_patient_demo_personal",
    email: "patient.demo@example.test",
    displayName: "Demo Patient",
    orgType: "personal",
    orgDisplayName: "Demo Patient (personal)",
    workosRole: "admin",
  },
]

async function upsertPersona(persona: SeedPersona) {
  const client = db()

  const [existingUser] = await client
    .select({ id: main.users.id })
    .from(main.users)
    .where(eq(main.users.workosUserId, persona.workosUserId))
    .limit(1)

  let userId = existingUser?.id
  if (!userId) {
    const [inserted] = await client
      .insert(main.users)
      .values({
        workosUserId: persona.workosUserId,
        email: persona.email,
        displayName: persona.displayName,
      })
      .returning({ id: main.users.id })
    userId = inserted!.id
  }

  const [existingOrg] = await client
    .select({ id: main.organizations.id })
    .from(main.organizations)
    .where(eq(main.organizations.workosOrgId, persona.workosOrgId))
    .limit(1)

  let orgId = existingOrg?.id
  if (!orgId) {
    const [inserted] = await client
      .insert(main.organizations)
      .values({
        workosOrgId: persona.workosOrgId,
        type: persona.orgType,
        displayName: persona.orgDisplayName,
      })
      .returning({ id: main.organizations.id })
    orgId = inserted!.id
  }

  const [existingMembership] = await client
    .select({ id: main.memberships.id })
    .from(main.memberships)
    .where(
      and(
        eq(main.memberships.userId, userId),
        eq(main.memberships.orgId, orgId)
      )
    )
    .limit(1)

  if (!existingMembership) {
    await client.insert(main.memberships).values({
      userId,
      orgId,
      workosRole: persona.workosRole,
      status: "active",
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
      practiceCountries: ["PT"],
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
