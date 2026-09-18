import { Resend } from "resend"
import { RESEND_IDEMPOTENCY_WINDOW_MS } from "./claim-delivery"

export const MAX_RESEND_LIST_PAGES = 3
export const MAX_RESEND_ADOPT_GETS = 20

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  deliveryId: string
}

export type ListedEmail = {
  id: string
  to?: string[] | string
  created_at?: Date | string
  createdAt?: Date | string
}

export type RetrievedEmail = {
  id: string
  tags?: Array<{ name: string; value: string }>
}

export type SendEmailResult = {
  providerId: string
}

function fromAddress(): string {
  const candidates = [
    process.env.RESEND_FROM_EMAIL,
    process.env.RESEND_EMAIL_BOOKINGS_FROM,
  ]
  return (
    candidates.map((value) => value?.trim()).find((value) => value) ??
    "Eleva.care <noreply@eleva.care>"
  )
}

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("[email] RESEND_API_KEY is not configured")
  }
  return new Resend(apiKey)
}

export async function sendViaResend(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const resend = getResend()
  const { data, error } = await resend.emails.send(
    {
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      tags: [{ name: "deliveryId", value: input.deliveryId }],
    },
    { idempotencyKey: input.deliveryId }
  )
  if (error) {
    throw new Error(error.message)
  }
  if (!data?.id) {
    throw new Error("[email] Resend accepted the send without an id")
  }
  return { providerId: data.id }
}

function emailMatches(listed: ListedEmail, recipient: string): boolean {
  const to = listed.to
  if (!to) return true
  const addresses = (Array.isArray(to) ? to : [to]).map((value) =>
    value.toLowerCase()
  )
  return addresses.includes(recipient.toLowerCase())
}

function createdAtOf(listed: ListedEmail): Date | null {
  const value = listed.created_at ?? listed.createdAt
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

export async function listResendEmails(input: {
  to: string
  since: Date
}): Promise<ListedEmail[]> {
  const resend = getResend()
  const matched: ListedEmail[] = []
  let after: string | undefined
  for (let page = 0; page < MAX_RESEND_LIST_PAGES; page += 1) {
    const { data, error } = await resend.emails.list({
      limit: 100,
      ...(after ? { after } : {}),
    })
    if (error) {
      throw new Error(error.message)
    }
    const items = (data?.data ?? []) as ListedEmail[]
    let reachedWindowStart = false
    for (const item of items) {
      const createdAt = createdAtOf(item)
      if (createdAt && createdAt < input.since) {
        reachedWindowStart = true
        continue
      }
      if (!emailMatches(item, input.to)) continue
      matched.push(item)
      if (matched.length >= MAX_RESEND_ADOPT_GETS) {
        return matched
      }
    }
    if (reachedWindowStart || !data?.has_more || items.length === 0) {
      break
    }
    after = items[items.length - 1]?.id
    if (!after) break
  }
  return matched
}

export async function getResendEmail(
  id: string
): Promise<RetrievedEmail | null> {
  const resend = getResend()
  const { data, error } = await resend.emails.get(id)
  if (error) {
    throw new Error(error.message)
  }
  if (!data) return null
  return data as RetrievedEmail
}

export async function adoptResendDelivery(input: {
  deliveryId: string
  to: string
  firstAttemptAt: Date
  now: Date
  listEmails?: (input: { to: string; since: Date }) => Promise<ListedEmail[]>
  getEmail?: (id: string) => Promise<RetrievedEmail | null>
}): Promise<string | null> {
  const ageMs = input.now.getTime() - input.firstAttemptAt.getTime()
  if (ageMs <= RESEND_IDEMPOTENCY_WINDOW_MS) return null

  const listEmails = input.listEmails ?? listResendEmails
  const getEmail = input.getEmail ?? getResendEmail
  const candidates = [
    ...(await listEmails({
      to: input.to,
      since: input.firstAttemptAt,
    })),
  ].sort((left, right) => {
    const leftAt = createdAtOf(left)?.getTime() ?? 0
    const rightAt = createdAtOf(right)?.getTime() ?? 0
    return rightAt - leftAt
  })
  let gets = 0
  for (const candidate of candidates) {
    const createdAt = createdAtOf(candidate)
    if (createdAt && createdAt < input.firstAttemptAt) break
    if (gets >= MAX_RESEND_ADOPT_GETS) break
    gets += 1
    const email = await getEmail(candidate.id)
    const tag = email?.tags?.find((item) => item.name === "deliveryId")
    if (tag?.value === input.deliveryId) {
      return email?.id ?? candidate.id
    }
  }
  return null
}
