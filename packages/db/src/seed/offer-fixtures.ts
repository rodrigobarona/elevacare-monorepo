import { and, eq, isNull } from "drizzle-orm"
import { db } from "../client"
import { withOrgContext, withPlatformAdminContext, type Tx } from "../context"
import * as auth from "../schema/auth"
import * as main from "../schema/main"
import {
  DEMO_BOOKING_LINK_EXPIRES_AT,
  DEMO_BOOKING_LINK_TOKENS,
  DEMO_PRIVATE_INVITE_NOTE,
  DEMO_PRIVATE_INVITE_PRICE_CENTS,
  DEMO_PRIVATE_INVITE_SLUG,
  hashDemoBookingLinkToken,
} from "./demo-booking-links"

/** EU launch list for the reference phone mode (D-02). */
export const EU_PHONE_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const

const WEEKDAYS = [1, 2, 3, 4, 5] as const

async function upsertUser(email: string, name: string): Promise<string> {
  const client = db()
  const [existing] = await client
    .select({ id: auth.user.id })
    .from(auth.user)
    .where(eq(auth.user.email, email))
    .limit(1)
  if (existing) return existing.id
  const [inserted] = await client
    .insert(auth.user)
    .values({
      id: crypto.randomUUID(),
      name,
      email,
      emailVerified: true,
    })
    .returning({ id: auth.user.id })
  return inserted!.id
}

async function upsertOrg(slug: string, name: string): Promise<string> {
  const client = db()
  const [existing] = await client
    .select({ id: auth.organization.id })
    .from(auth.organization)
    .where(eq(auth.organization.slug, slug))
    .limit(1)
  if (existing) return existing.id
  const [inserted] = await client
    .insert(auth.organization)
    .values({
      id: crypto.randomUUID(),
      name,
      slug,
      type: "expert",
    })
    .returning({ id: auth.organization.id })
  return inserted!.id
}

async function ensureMembership(userId: string, orgId: string) {
  const client = db()
  const [existing] = await client
    .select({ id: auth.member.id })
    .from(auth.member)
    .where(
      and(eq(auth.member.userId, userId), eq(auth.member.organizationId, orgId))
    )
    .limit(1)
  if (existing) return
  await client.insert(auth.member).values({
    id: crypto.randomUUID(),
    userId,
    organizationId: orgId,
    role: "owner",
  })
}

async function upsertExpert(
  tx: Tx,
  input: {
    userId: string
    orgId: string
    username: string
    displayName: string
    languages: string[]
    practiceCountry: string
    serviceCountries: string[]
    worldwideRemote: boolean
  }
): Promise<string> {
  const [existing] = await tx
    .select({ id: main.expertProfiles.id })
    .from(main.expertProfiles)
    .where(eq(main.expertProfiles.username, input.username))
    .limit(1)
  if (existing) {
    return existing.id
  }
  const [inserted] = await tx
    .insert(main.expertProfiles)
    .values({
      orgId: input.orgId,
      userId: input.userId,
      username: input.username,
      displayName: input.displayName,
      headline: "Reference offer fixture.",
      languages: input.languages,
      practiceCountry: input.practiceCountry,
      practiceCountries: [input.practiceCountry],
      serviceCountries: input.serviceCountries,
      worldwideRemote: input.worldwideRemote,
      worldwideMode: input.worldwideRemote,
      sessionModes: ["online", "phone", "in_person"],
      status: "active",
    })
    .returning({ id: main.expertProfiles.id })
  return inserted!.id
}

async function ensureHandle(handle: string, ownerId: string) {
  await withPlatformAdminContext(async (tx) => {
    const [inserted] = await tx
      .insert(main.publicHandles)
      .values({ handle, ownerKind: "expert", ownerId })
      .onConflictDoNothing()
      .returning({
        ownerKind: main.publicHandles.ownerKind,
        ownerId: main.publicHandles.ownerId,
      })
    if (inserted) return
    const [existing] = await tx
      .select({
        ownerKind: main.publicHandles.ownerKind,
        ownerId: main.publicHandles.ownerId,
      })
      .from(main.publicHandles)
      .where(eq(main.publicHandles.handle, handle))
      .limit(1)
    if (
      !existing ||
      existing.ownerKind !== "expert" ||
      existing.ownerId !== ownerId
    ) {
      throw new Error(`public handle ${handle} belongs to another owner`)
    }
  })
}

async function upsertSchedule(
  tx: Tx,
  input: {
    orgId: string
    expertProfileId: string
    name: string
    timezone: string
    isDefault?: boolean
  }
): Promise<string> {
  const [existing] = await tx
    .select({ id: main.schedules.id })
    .from(main.schedules)
    .where(
      and(
        eq(main.schedules.expertProfileId, input.expertProfileId),
        eq(main.schedules.name, input.name)
      )
    )
    .limit(1)
  if (existing) return existing.id
  const [inserted] = await tx
    .insert(main.schedules)
    .values({
      orgId: input.orgId,
      expertProfileId: input.expertProfileId,
      name: input.name,
      timezone: input.timezone,
      isDefault: input.isDefault ?? false,
    })
    .returning({ id: main.schedules.id })
  await tx.insert(main.availabilityRules).values(
    WEEKDAYS.map((dayOfWeek) => ({
      orgId: input.orgId,
      scheduleId: inserted!.id,
      dayOfWeek,
      startTime: "09:00:00",
      endTime: "17:00:00",
    }))
  )
  return inserted!.id
}

async function upsertEventType(
  tx: Tx,
  input: {
    orgId: string
    expertProfileId: string
    slug: string
    title: main.LocalizedText
    kind: "clinical" | "non_clinical"
    durationMinutes: number
    priceAmount: number
    languages: string[]
    published?: boolean
  }
): Promise<string> {
  const [existing] = await tx
    .select({ id: main.eventTypes.id })
    .from(main.eventTypes)
    .where(
      and(
        eq(main.eventTypes.expertProfileId, input.expertProfileId),
        eq(main.eventTypes.slug, input.slug)
      )
    )
    .limit(1)
  if (existing) {
    if (input.published !== undefined) {
      await tx
        .update(main.eventTypes)
        .set({ published: input.published })
        .where(eq(main.eventTypes.id, existing.id))
    }
    return existing.id
  }
  const [inserted] = await tx
    .insert(main.eventTypes)
    .values({
      orgId: input.orgId,
      expertProfileId: input.expertProfileId,
      slug: input.slug,
      title: input.title,
      kind: input.kind,
      visibility: "public",
      durationMinutes: input.durationMinutes,
      priceAmount: input.priceAmount,
      currency: "EUR",
      languages: input.languages,
      published: input.published ?? true,
      active: true,
    })
    .returning({ id: main.eventTypes.id })
  return inserted!.id
}

async function ensureMode(
  tx: Tx,
  input: {
    orgId: string
    eventTypeId: string
    mode: "online" | "phone" | "in_person"
    scheduleId: string
    locationId?: string
    countryScopeType: "worldwide" | "list"
    countryScopeCodes: string[]
    languages: string[]
    priceCents?: number
    sortOrder: number
  }
) {
  const [existing] = await tx
    .select({ id: main.eventTypeModes.id })
    .from(main.eventTypeModes)
    .where(
      and(
        eq(main.eventTypeModes.eventTypeId, input.eventTypeId),
        eq(main.eventTypeModes.mode, input.mode),
        input.locationId == null
          ? isNull(main.eventTypeModes.locationId)
          : eq(main.eventTypeModes.locationId, input.locationId)
      )
    )
    .limit(1)
  if (existing) return existing.id
  const [inserted] = await tx
    .insert(main.eventTypeModes)
    .values({
      orgId: input.orgId,
      eventTypeId: input.eventTypeId,
      mode: input.mode,
      scheduleId: input.scheduleId,
      locationId: input.locationId,
      countryScopeType: input.countryScopeType,
      countryScopeCodes: input.countryScopeCodes,
      languages: input.languages,
      priceCents: input.priceCents,
      currency: input.priceCents == null ? undefined : "EUR",
      sortOrder: input.sortOrder,
      active: true,
    })
    .returning({ id: main.eventTypeModes.id })
  return inserted!.id
}

async function upsertBookingLink(
  tx: Tx,
  input: {
    orgId: string
    eventTypeId: string
    eventTypeModeId: string
    scheduleId: string
    token: string
    priceCents: number
    note: string
    maxUses: number
    useCount: number
    createdBy: string
  }
) {
  const tokenHash = hashDemoBookingLinkToken(input.token)
  const values = {
    orgId: input.orgId,
    eventTypeId: input.eventTypeId,
    eventTypeModeId: input.eventTypeModeId,
    scheduleId: input.scheduleId,
    tokenHash,
    priceCents: input.priceCents,
    note: input.note,
    expiresAt: DEMO_BOOKING_LINK_EXPIRES_AT,
    maxUses: input.maxUses,
    useCount: input.useCount,
    createdBy: input.createdBy,
    revokedAt: null,
  }
  const [existing] = await tx
    .select({ id: main.bookingLinks.id })
    .from(main.bookingLinks)
    .where(eq(main.bookingLinks.tokenHash, tokenHash))
    .limit(1)
  if (existing) {
    await tx
      .update(main.bookingLinks)
      .set(values)
      .where(eq(main.bookingLinks.id, existing.id))
    return existing.id
  }
  const [inserted] = await tx
    .insert(main.bookingLinks)
    .values(values)
    .returning({ id: main.bookingLinks.id })
  return inserted!.id
}

async function upsertLocation(
  tx: Tx,
  input: {
    orgId: string
    expertProfileId: string
    name: string
    address: string
    city: string
    region: string
    country: string
    timezone: string
    isPrimary?: boolean
  }
): Promise<string> {
  const [existing] = await tx
    .select({ id: main.expertPracticeLocations.id })
    .from(main.expertPracticeLocations)
    .where(
      and(
        eq(main.expertPracticeLocations.expertProfileId, input.expertProfileId),
        eq(main.expertPracticeLocations.name, input.name)
      )
    )
    .limit(1)
  if (existing) return existing.id
  const [inserted] = await tx
    .insert(main.expertPracticeLocations)
    .values({
      orgId: input.orgId,
      expertProfileId: input.expertProfileId,
      name: input.name,
      address: input.address,
      city: input.city,
      region: input.region,
      country: input.country,
      timezone: input.timezone,
      isPrimary: input.isPrimary ?? false,
      active: true,
    })
    .returning({ id: main.expertPracticeLocations.id })
  return inserted!.id
}

async function seedQuickChat() {
  const userId = await upsertUser("coach.quick@example.test", "Ana Quick")
  const orgId = await upsertOrg("anaquick", "Ana Quick (solo)")
  await ensureMembership(userId, orgId)
  const expertId = await withOrgContext(orgId, async (tx) => {
    const profileId = await upsertExpert(tx, {
      userId,
      orgId,
      username: "anaquick",
      displayName: "Ana Quick",
      languages: ["pt", "en", "es", "fr"],
      practiceCountry: "PT",
      serviceCountries: [...EU_PHONE_COUNTRIES],
      worldwideRemote: true,
    })
    const onlineSchedule = await upsertSchedule(tx, {
      orgId,
      expertProfileId: profileId,
      name: "Online",
      timezone: "Europe/Lisbon",
      isDefault: true,
    })
    const phoneSchedule = await upsertSchedule(tx, {
      orgId,
      expertProfileId: profileId,
      name: "Phone",
      timezone: "Europe/Lisbon",
    })
    const eventTypeId = await upsertEventType(tx, {
      orgId,
      expertProfileId: profileId,
      slug: "quick-chat",
      title: { en: "Quick chat", pt: "Conversa rápida", es: "Charla rápida" },
      kind: "non_clinical",
      durationMinutes: 20,
      priceAmount: 0,
      languages: ["pt", "en", "es", "fr"],
    })
    await ensureMode(tx, {
      orgId,
      eventTypeId,
      mode: "online",
      scheduleId: onlineSchedule,
      countryScopeType: "worldwide",
      countryScopeCodes: [],
      languages: ["pt", "en", "es", "fr"],
      sortOrder: 0,
    })
    await ensureMode(tx, {
      orgId,
      eventTypeId,
      mode: "phone",
      scheduleId: phoneSchedule,
      countryScopeType: "list",
      countryScopeCodes: [...EU_PHONE_COUNTRIES],
      languages: ["pt", "en", "es", "fr"],
      sortOrder: 1,
    })
    return profileId
  })
  await ensureHandle("anaquick", expertId)
}

async function seedPhysiotherapy() {
  const userId = await upsertUser("fisio.mota@example.test", "Fisio Mota")
  const orgId = await upsertOrg("fisiomota", "Fisio Mota (solo)")
  await ensureMembership(userId, orgId)
  const expertId = await withOrgContext(orgId, async (tx) => {
    const profileId = await upsertExpert(tx, {
      userId,
      orgId,
      username: "fisiomota",
      displayName: "Fisio Mota",
      languages: ["pt", "en", "es"],
      practiceCountry: "PT",
      serviceCountries: ["PT", "ES"],
      worldwideRemote: false,
    })
    const onlineSchedule = await upsertSchedule(tx, {
      orgId,
      expertProfileId: profileId,
      name: "Online",
      timezone: "Europe/Lisbon",
      isDefault: true,
    })
    const lisboa = await upsertLocation(tx, {
      orgId,
      expertProfileId: profileId,
      name: "Lisboa",
      address: "Av. da Liberdade 100",
      city: "Lisboa",
      region: "Lisboa",
      country: "PT",
      timezone: "Europe/Lisbon",
      isPrimary: true,
    })
    const porto = await upsertLocation(tx, {
      orgId,
      expertProfileId: profileId,
      name: "Porto",
      address: "Rua de Santa Catarina 200",
      city: "Porto",
      region: "Porto",
      country: "PT",
      timezone: "Europe/Lisbon",
    })
    const madrid = await upsertLocation(tx, {
      orgId,
      expertProfileId: profileId,
      name: "Madrid",
      address: "Calle de Alcalá 50",
      city: "Madrid",
      region: "Madrid",
      country: "ES",
      timezone: "Europe/Madrid",
    })
    const lisboaSchedule = await upsertSchedule(tx, {
      orgId,
      expertProfileId: profileId,
      name: "Lisboa clinic",
      timezone: "Europe/Lisbon",
    })
    const portoSchedule = await upsertSchedule(tx, {
      orgId,
      expertProfileId: profileId,
      name: "Porto clinic",
      timezone: "Europe/Lisbon",
    })
    const madridSchedule = await upsertSchedule(tx, {
      orgId,
      expertProfileId: profileId,
      name: "Madrid clinic",
      timezone: "Europe/Madrid",
    })
    const firstVisitId = await upsertEventType(tx, {
      orgId,
      expertProfileId: profileId,
      slug: "first-visit",
      title: {
        en: "First visit",
        pt: "Primeira consulta",
        es: "Primera visita",
      },
      kind: "clinical",
      durationMinutes: 60,
      priceAmount: 6000,
      languages: ["pt", "en", "es"],
    })
    await ensureMode(tx, {
      orgId,
      eventTypeId: firstVisitId,
      mode: "online",
      scheduleId: onlineSchedule,
      countryScopeType: "list",
      countryScopeCodes: ["PT", "ES"],
      languages: ["pt", "en", "es"],
      priceCents: 6000,
      sortOrder: 0,
    })
    const followUpId = await upsertEventType(tx, {
      orgId,
      expertProfileId: profileId,
      slug: "follow-up",
      title: { en: "Follow-up", pt: "Seguimento", es: "Seguimiento" },
      kind: "clinical",
      durationMinutes: 45,
      priceAmount: 4500,
      languages: ["pt", "en", "es"],
    })
    await ensureMode(tx, {
      orgId,
      eventTypeId: followUpId,
      mode: "in_person",
      scheduleId: lisboaSchedule,
      locationId: lisboa,
      countryScopeType: "list",
      countryScopeCodes: ["PT"],
      languages: ["pt", "en", "es"],
      priceCents: 4500,
      sortOrder: 0,
    })
    await ensureMode(tx, {
      orgId,
      eventTypeId: followUpId,
      mode: "in_person",
      scheduleId: portoSchedule,
      locationId: porto,
      countryScopeType: "list",
      countryScopeCodes: ["PT"],
      languages: ["pt", "en", "es"],
      priceCents: 4500,
      sortOrder: 1,
    })
    await ensureMode(tx, {
      orgId,
      eventTypeId: followUpId,
      mode: "in_person",
      scheduleId: madridSchedule,
      locationId: madrid,
      countryScopeType: "list",
      countryScopeCodes: ["ES"],
      languages: ["pt", "en", "es"],
      priceCents: 5500,
      sortOrder: 2,
    })
    const privateInviteId = await upsertEventType(tx, {
      orgId,
      expertProfileId: profileId,
      slug: DEMO_PRIVATE_INVITE_SLUG,
      title: {
        en: "Private invite",
        pt: "Convite privado",
        es: "Invitación privada",
      },
      kind: "clinical",
      durationMinutes: 60,
      priceAmount: 6000,
      languages: ["pt", "en", "es"],
      published: false,
    })
    const privateModeId = await ensureMode(tx, {
      orgId,
      eventTypeId: privateInviteId,
      mode: "online",
      scheduleId: onlineSchedule,
      countryScopeType: "list",
      countryScopeCodes: ["PT", "ES"],
      languages: ["pt", "en", "es"],
      priceCents: 6000,
      sortOrder: 0,
    })
    const linkInput = {
      orgId,
      eventTypeId: privateInviteId,
      eventTypeModeId: privateModeId,
      scheduleId: onlineSchedule,
      priceCents: DEMO_PRIVATE_INVITE_PRICE_CENTS,
      note: DEMO_PRIVATE_INVITE_NOTE,
      createdBy: userId,
    }
    await upsertBookingLink(tx, {
      ...linkInput,
      token: DEMO_BOOKING_LINK_TOKENS.open,
      maxUses: 1,
      useCount: 0,
    })
    await upsertBookingLink(tx, {
      ...linkInput,
      token: DEMO_BOOKING_LINK_TOKENS.exhausted,
      maxUses: 1,
      useCount: 1,
    })
    return profileId
  })
  await ensureHandle("fisiomota", expertId)
}

export async function seedOfferFixtures() {
  await seedQuickChat()
  await seedPhysiotherapy()
}
