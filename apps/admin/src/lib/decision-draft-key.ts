/** Every decision draft in a tab's storage starts with this. */
export const DECISION_DRAFT_PREFIX = "eleva.decision-draft:"

/** Where one review's draft is kept while the reviewer signs in. */
export function decisionDraftKey(
  subject: "clinic" | "expert",
  reviewId: string
): string {
  return `${DECISION_DRAFT_PREFIX}${subject}:${reviewId}`
}
