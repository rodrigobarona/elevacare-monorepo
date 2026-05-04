import { eq } from "drizzle-orm"
import { db } from "../client"
import * as main from "../schema/main"

/**
 * Expert category taxonomy seed.
 *
 * Source: search-and-discovery-spec.md (recommended P1 categories)
 * + ADR-013 Tier 2 expert types. Slugs are reserved in
 * @eleva/config/reserved-usernames so no expert can grab them.
 *
 * Idempotent: matches on `slug` and updates display + description
 * if drifted; creates if missing.
 *
 * Run via:
 *   pnpm --filter=@eleva/db db:seed:categories
 */

interface CategorySeed {
  slug: string
  displayName: { en: string; pt: string; es: string }
  description: { en: string; pt: string; es: string }
  icon?: string
  sortOrder: number
}

const CATEGORIES: CategorySeed[] = [
  {
    slug: "psychology",
    displayName: {
      en: "Psychology",
      pt: "Psicologia",
      es: "Psicología",
    },
    description: {
      en: "Licensed psychologists for therapy, counseling, and mental wellbeing.",
      pt: "Psicólogos licenciados para terapia, aconselhamento e bem-estar mental.",
      es: "Psicólogos licenciados para terapia, asesoramiento y bienestar mental.",
    },
    icon: "brain",
    sortOrder: 10,
  },
  {
    slug: "nutrition",
    displayName: {
      en: "Nutrition",
      pt: "Nutrição",
      es: "Nutrición",
    },
    description: {
      en: "Registered nutritionists and dietitians for personalized food and lifestyle plans.",
      pt: "Nutricionistas e dietistas licenciados para planos alimentares e de estilo de vida personalizados.",
      es: "Nutricionistas y dietistas registrados para planes personalizados de alimentación y estilo de vida.",
    },
    icon: "salad",
    sortOrder: 20,
  },
  {
    slug: "physiotherapy",
    displayName: {
      en: "Physiotherapy",
      pt: "Fisioterapia",
      es: "Fisioterapia",
    },
    description: {
      en: "Physiotherapists for movement assessment, recovery, and rehabilitation.",
      pt: "Fisioterapeutas para avaliação de movimento, recuperação e reabilitação.",
      es: "Fisioterapeutas para evaluación del movimiento, recuperación y rehabilitación.",
    },
    icon: "activity",
    sortOrder: 30,
  },
  {
    slug: "midwifery",
    displayName: {
      en: "Midwifery",
      pt: "Parteira",
      es: "Matrona",
    },
    description: {
      en: "Certified midwives for pregnancy, birth, and postpartum care.",
      pt: "Parteiras certificadas para gravidez, parto e cuidados pós-parto.",
      es: "Matronas certificadas para embarazo, parto y cuidados posparto.",
    },
    icon: "baby",
    sortOrder: 40,
  },
  {
    slug: "pelvic-health",
    displayName: {
      en: "Pelvic health",
      pt: "Saúde pélvica",
      es: "Salud pélvica",
    },
    description: {
      en: "Specialists in pelvic-floor assessment and care across life stages.",
      pt: "Especialistas em avaliação e cuidado do pavimento pélvico em todas as fases da vida.",
      es: "Especialistas en evaluación y cuidado del suelo pélvico en todas las etapas de la vida.",
    },
    icon: "heart-pulse",
    sortOrder: 50,
  },
  {
    slug: "lactation",
    displayName: {
      en: "Lactation",
      pt: "Lactação",
      es: "Lactancia",
    },
    description: {
      en: "IBCLC-certified lactation consultants for breastfeeding support.",
      pt: "Consultoras de lactação certificadas IBCLC para apoio à amamentação.",
      es: "Consultoras de lactancia certificadas IBCLC para apoyo a la lactancia.",
    },
    icon: "droplet",
    sortOrder: 60,
  },
  {
    slug: "fertility",
    displayName: {
      en: "Fertility",
      pt: "Fertilidade",
      es: "Fertilidad",
    },
    description: {
      en: "Reproductive-health experts and fertility coaches.",
      pt: "Especialistas em saúde reprodutiva e coaches de fertilidade.",
      es: "Especialistas en salud reproductiva y coaches de fertilidad.",
    },
    icon: "flower",
    sortOrder: 70,
  },
  {
    slug: "mental-health-coaching",
    displayName: {
      en: "Mental health coaching",
      pt: "Coaching de saúde mental",
      es: "Coaching de salud mental",
    },
    description: {
      en: "Coaches for mindset, stress management, and life transitions.",
      pt: "Coaches para mentalidade, gestão do stress e transições de vida.",
      es: "Coaches para mentalidad, gestión del estrés y transiciones vitales.",
    },
    icon: "compass",
    sortOrder: 80,
  },
  {
    slug: "wellness",
    displayName: {
      en: "Wellness",
      pt: "Bem-estar",
      es: "Bienestar",
    },
    description: {
      en: "General wellness practitioners — yoga, breathwork, meditation, and lifestyle.",
      pt: "Profissionais de bem-estar geral — yoga, respiração, meditação e estilo de vida.",
      es: "Profesionales de bienestar general — yoga, respiración, meditación y estilo de vida.",
    },
    icon: "sun",
    sortOrder: 90,
  },
]

export async function seedExpertCategories(): Promise<{
  inserted: number
  updated: number
}> {
  const client = db()
  let inserted = 0
  let updated = 0

  for (const cat of CATEGORIES) {
    const [existing] = await client
      .select({
        id: main.expertCategories.id,
        displayName: main.expertCategories.displayName,
      })
      .from(main.expertCategories)
      .where(eq(main.expertCategories.slug, cat.slug))
      .limit(1)

    if (!existing) {
      await client.insert(main.expertCategories).values({
        slug: cat.slug,
        displayName: cat.displayName,
        description: cat.description,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
      })
      inserted++
    } else {
      await client
        .update(main.expertCategories)
        .set({
          displayName: cat.displayName,
          description: cat.description,
          icon: cat.icon,
          sortOrder: cat.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(main.expertCategories.id, existing.id))
      updated++
    }
  }

  return { inserted, updated }
}

export const EXPERT_CATEGORY_SEEDS = CATEGORIES
