import type { MarketplaceCategorySlug } from "./marketplace-categories"

/**
 * The questions the homepage is built from. Each one names the area of care
 * whose experts answer it; the words live under `home.questions.items.<id>`.
 * Keep to questions the listed experts can take: an area with nobody listed
 * sends the visitor to the whole directory instead.
 *
 * The first four show on a phone, so they cover four different moments of
 * life.
 */
export const HOME_QUESTIONS = [
  { id: "leakLaugh", category: "pelvic-health" },
  { id: "backPainPregnancy", category: "physiotherapy" },
  { id: "eatTrying", category: "nutrition" },
  { id: "pelvicFloorMenopause", category: "pelvic-health" },
  { id: "healAfterBirth", category: "pelvic-health" },
  { id: "painfulPeriods", category: "pelvic-health" },
  { id: "livingWithPain", category: "physiotherapy" },
  { id: "movingAfterCancer", category: "physiotherapy" },
] as const satisfies readonly {
  id: string
  category: MarketplaceCategorySlug
}[]

export type HomeQuestionId = (typeof HOME_QUESTIONS)[number]["id"]

/**
 * Which question the hero shows while each scene of the `hero-intro` film
 * plays. `from` is the second the scene starts; `id` is a question above, or
 * null for the hero's own opening question. Re-time this when the film is
 * recut.
 */
export const HERO_FILM_QUESTIONS: readonly {
  from: number
  id: HomeQuestionId | null
}[] = [
  { from: 0, id: null }, // women of every age, then two friends, then a fair
  { from: 22.3, id: "backPainPregnancy" }, // pregnant, in her kitchen
  { from: 41.4, id: "healAfterBirth" }, // a newborn asleep
  { from: 52.6, id: "eatTrying" }, // two women cooking
  { from: 66.6, id: "healAfterBirth" }, // a baby's foot in a hand
  { from: 77, id: "livingWithPain" }, // a woman comforted by a friend
  { from: 85, id: "leakLaugh" }, // friends laughing on a ride
  { from: 104.3, id: "painfulPeriods" }, // cloth pads among petals
  { from: 116.9, id: "pelvicFloorMenopause" }, // an older woman at a café
]
