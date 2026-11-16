import { findOwnedExpertPractice } from "@eleva/auth"
import { resolveGatewayUrl } from "@eleva/config/env"
import { expertWorkspaceBase } from "@eleva/config/routing"
import type { ExistingPractice } from "./nav-types"

export type { ExistingPractice } from "./nav-types"

/**
 * The expert practice this person owns (one per person, ADR-026), for the
 * workspace picker: it offers "Open your practice" instead of a second
 * setup. Same rule the API enforces, so the two never disagree.
 */
export async function loadExistingPractice(
  userId: string
): Promise<ExistingPractice | null> {
  const practice = await findOwnedExpertPractice(userId)
  if (!practice) return null
  return {
    name: practice.name,
    href: `${resolveGatewayUrl()}${expertWorkspaceBase(practice.slug)}`,
  }
}
