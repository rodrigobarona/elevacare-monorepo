import { EU_PHONE_COUNTRIES } from "@eleva/config"
import type { ExpertCredential, LocalizedText } from "../schema/main"
import type { FixtureLicence } from "./licence-fixture"

export type OfferFixtureMode = {
  mode: "online" | "phone" | "in_person"
  schedule: string
  location?: string
  countryScopeType: "worldwide" | "list"
  countryScopeCodes: string[]
  languages: string[]
  priceCents?: number
}

export type OfferFixtureEventType = {
  slug: string
  title: LocalizedText
  /** One sentence shown on the service card. */
  description?: LocalizedText
  kind: "clinical" | "non_clinical"
  durationMinutes: number
  priceAmount: number
  languages: string[]
  modes: OfferFixtureMode[]
}

export type OfferFixtureLocation = {
  name: string
  address: string
  city: string
  region: string
  country: string
  timezone: string
  isPrimary?: boolean
}

export type OfferFixtureSchedule = {
  name: string
  timezone: string
  isDefault?: boolean
}

/**
 * What a member reads about the expert. Demo personas are fictional; they
 * exist so profile, explorer and dashboard designs are judged on realistic
 * content instead of placeholders.
 */
export type OfferFixturePersona = {
  headline: string
  bio: string
  credentials: ExpertCredential[]
  /** Category slugs from `expert-categories.ts`, most relevant first. */
  categories: string[]
  /**
   * Square portrait at `demo/experts/{username}.jpg` in the public bucket,
   * uploaded with `pnpm --filter @eleva/media media:demo-portrait`. `null`
   * keeps an expert without a photo, a state real profiles also have.
   */
  portrait: { pexelsId: string; photographer: string } | null
}

export type OfferFixture = {
  user: { email: string; name: string }
  org: { slug: string; name: string }
  profile: {
    username: string
    displayName: string
    languages: string[]
    practiceCountry: string
    serviceCountries: string[]
    worldwideRemote: boolean
  }
  persona: OfferFixturePersona
  /** Defaults to the placeholder physiotherapy licence. */
  licence?: FixtureLicence
  schedules: OfferFixtureSchedule[]
  locations: OfferFixtureLocation[]
  eventTypes: OfferFixtureEventType[]
}

/** Every fixture schedule is open Monday–Friday 09:00–17:00 in its timezone. */
export const OFFER_FIXTURE_WEEKDAYS = [1, 2, 3, 4, 5] as const
export const OFFER_FIXTURE_DAY_START = "09:00:00"
export const OFFER_FIXTURE_DAY_END = "17:00:00"

const QUICK_CHAT_LANGUAGES = ["pt", "en", "es", "fr"]

export const QUICK_CHAT_FIXTURE: OfferFixture = {
  user: { email: "coach.quick@example.test", name: "Ana Rocha" },
  org: { slug: "anaquick", name: "Ana Rocha" },
  profile: {
    username: "anaquick",
    displayName: "Ana Rocha",
    languages: QUICK_CHAT_LANGUAGES,
    practiceCountry: "PT",
    serviceCountries: [...EU_PHONE_COUNTRIES],
    worldwideRemote: true,
  },
  persona: {
    headline: "Health coach for perimenopause, sleep and energy",
    bio: "I help women in their forties and fifties make sense of what is changing in their bodies and build habits that last. We start with a short chat about what matters to you, then agree on one or two small changes to try before we talk again. I work alongside your doctor, never instead of them.",
    credentials: [
      {
        title: "Certified health coach",
        institution: "European Mentoring and Coaching Council",
        year: 2019,
      },
      {
        title: "BSc in Human Nutrition",
        institution: "Universidade do Porto",
        year: 2012,
      },
    ],
    categories: ["mental-health-coaching", "wellness"],
    portrait: { pexelsId: "16160809", photographer: "pessoas uem" },
  },
  schedules: [
    { name: "Online", timezone: "Europe/Lisbon", isDefault: true },
    { name: "Phone", timezone: "Europe/Lisbon" },
  ],
  locations: [],
  eventTypes: [
    {
      slug: "quick-chat",
      title: { en: "Quick chat", pt: "Conversa rápida", es: "Charla rápida" },
      description: {
        en: "A free 20-minute call to see whether coaching is right for you.",
        pt: "Uma chamada gratuita de 20 minutos para perceber se o coaching é para si.",
        es: "Una llamada gratuita de 20 minutos para ver si el coaching es para ti.",
      },
      kind: "non_clinical",
      durationMinutes: 20,
      priceAmount: 0,
      languages: QUICK_CHAT_LANGUAGES,
      modes: [
        {
          mode: "online",
          schedule: "Online",
          countryScopeType: "worldwide",
          countryScopeCodes: [],
          languages: QUICK_CHAT_LANGUAGES,
        },
        {
          mode: "phone",
          schedule: "Phone",
          countryScopeType: "list",
          countryScopeCodes: [...EU_PHONE_COUNTRIES],
          languages: QUICK_CHAT_LANGUAGES,
        },
      ],
    },
  ],
}

const PHYSIO_LANGUAGES = ["pt", "en", "es"]

export const PHYSIOTHERAPY_FIXTURE: OfferFixture = {
  user: { email: "fisio.mota@example.test", name: "Inês Mota" },
  org: { slug: "fisiomota", name: "Inês Mota" },
  profile: {
    username: "fisiomota",
    displayName: "Inês Mota",
    languages: PHYSIO_LANGUAGES,
    practiceCountry: "PT",
    serviceCountries: ["PT", "ES"],
    worldwideRemote: false,
  },
  persona: {
    headline: "Pelvic health physiotherapist",
    bio: "I am a physiotherapist specialised in pelvic health. I see women in pregnancy, after birth and through menopause for leaking, pain, prolapse and getting back to sport. A first visit is a calm conversation and a clear plan you can follow at home; an internal exam only ever happens if you want it and it helps.",
    credentials: [
      {
        title: "MSc in Women's Health Physiotherapy",
        institution: "Escola Superior de Tecnologia da Saúde de Lisboa",
        year: 2016,
      },
      {
        title: "Postgraduate certificate in pelvic floor rehabilitation",
        institution: "Universidade de Coimbra",
        year: 2019,
      },
      {
        title: "BSc in Physiotherapy",
        institution: "Escola Superior de Saúde do Porto",
        year: 2012,
      },
    ],
    categories: ["pelvic-health", "physiotherapy"],
    portrait: { pexelsId: "16160869", photographer: "pessoas uem" },
  },
  schedules: [
    { name: "Online", timezone: "Europe/Lisbon", isDefault: true },
    { name: "Lisboa clinic", timezone: "Europe/Lisbon" },
    { name: "Porto clinic", timezone: "Europe/Lisbon" },
    { name: "Madrid clinic", timezone: "Europe/Madrid" },
  ],
  locations: [
    {
      name: "Lisboa",
      address: "Av. da Liberdade 100",
      city: "Lisboa",
      region: "Lisboa",
      country: "PT",
      timezone: "Europe/Lisbon",
      isPrimary: true,
    },
    {
      name: "Porto",
      address: "Rua de Santa Catarina 200",
      city: "Porto",
      region: "Porto",
      country: "PT",
      timezone: "Europe/Lisbon",
    },
    {
      name: "Madrid",
      address: "Calle de Alcalá 50",
      city: "Madrid",
      region: "Madrid",
      country: "ES",
      timezone: "Europe/Madrid",
    },
  ],
  eventTypes: [
    {
      slug: "first-visit",
      title: {
        en: "First visit",
        pt: "Primeira consulta",
        es: "Primera visita",
      },
      description: {
        en: "We talk through what is going on and leave with a plan you can start at home.",
        pt: "Falamos sobre o que se passa e sai com um plano para começar em casa.",
        es: "Hablamos de lo que te pasa y te llevas un plan para empezar en casa.",
      },
      kind: "clinical",
      durationMinutes: 60,
      priceAmount: 6000,
      languages: PHYSIO_LANGUAGES,
      modes: [
        {
          mode: "online",
          schedule: "Online",
          countryScopeType: "list",
          countryScopeCodes: ["PT", "ES"],
          languages: PHYSIO_LANGUAGES,
          priceCents: 6000,
        },
      ],
    },
    {
      slug: "follow-up",
      title: { en: "Follow-up", pt: "Seguimento", es: "Seguimiento" },
      description: {
        en: "Hands-on treatment in the clinic and an updated home exercise plan.",
        pt: "Tratamento presencial na clínica e um plano de exercícios atualizado.",
        es: "Tratamiento presencial en la clínica y un plan de ejercicios actualizado.",
      },
      kind: "clinical",
      durationMinutes: 45,
      priceAmount: 4500,
      languages: PHYSIO_LANGUAGES,
      modes: [
        {
          mode: "in_person",
          schedule: "Lisboa clinic",
          location: "Lisboa",
          countryScopeType: "list",
          countryScopeCodes: ["PT"],
          languages: PHYSIO_LANGUAGES,
          priceCents: 4500,
        },
        {
          mode: "in_person",
          schedule: "Porto clinic",
          location: "Porto",
          countryScopeType: "list",
          countryScopeCodes: ["PT"],
          languages: PHYSIO_LANGUAGES,
          priceCents: 4500,
        },
        {
          mode: "in_person",
          schedule: "Madrid clinic",
          location: "Madrid",
          countryScopeType: "list",
          countryScopeCodes: ["ES"],
          languages: PHYSIO_LANGUAGES,
          priceCents: 5500,
        },
      ],
    },
  ],
}

const ONLINE_LISBON: OfferFixtureSchedule = {
  name: "Online",
  timezone: "Europe/Lisbon",
  isDefault: true,
}

function onlineOffer(input: {
  slug: string
  title: LocalizedText
  description: LocalizedText
  kind: "clinical" | "non_clinical"
  durationMinutes: number
  priceCents: number
  languages: string[]
  countries: string[]
  phone?: boolean
}): OfferFixtureEventType {
  const scope = {
    countryScopeType: "list" as const,
    countryScopeCodes: input.countries,
    languages: input.languages,
    priceCents: input.priceCents,
  }
  return {
    slug: input.slug,
    title: input.title,
    description: input.description,
    kind: input.kind,
    durationMinutes: input.durationMinutes,
    priceAmount: input.priceCents,
    languages: input.languages,
    modes: [
      { mode: "online", schedule: "Online", ...scope },
      ...(input.phone
        ? [{ mode: "phone" as const, schedule: "Online", ...scope }]
        : []),
    ],
  }
}

/**
 * More fictional experts so the explorer, homepage and filters have
 * something to show. One of them (Clara Neves) has no photo on purpose.
 */
export const DEMO_EXPERT_FIXTURES: OfferFixture[] = [
  {
    user: { email: "marta.sousa@example.test", name: "Marta Sousa" },
    org: { slug: "martasousa", name: "Marta Sousa" },
    profile: {
      username: "martasousa",
      displayName: "Marta Sousa",
      languages: ["pt", "en"],
      practiceCountry: "PT",
      serviceCountries: ["PT"],
      worldwideRemote: false,
    },
    persona: {
      headline: "Midwife for pregnancy, birth plans and the first weeks home",
      bio: "I have been a midwife for twelve years, first in a Lisbon maternity ward and now on my own. I help you prepare for birth, write a birth plan you actually understand, and find your feet in the first weeks at home. Bring every question, including the ones that feel small.",
      credentials: [
        {
          title: "Specialist nurse in maternal and obstetric health",
          institution: "Escola Superior de Enfermagem de Lisboa",
          year: 2013,
        },
        {
          title: "BSc in Nursing",
          institution: "Universidade de Lisboa",
          year: 2010,
        },
      ],
      categories: ["midwifery", "lactation"],
      portrait: { pexelsId: "29995629", photographer: "Tran Nhu Tuan" },
    },
    licence: {
      professionalBody: "ordem_enfermeiros",
      licenceNumber: "DEMO-2048",
      ersRegistrationNumber: "E000001",
    },
    schedules: [ONLINE_LISBON],
    locations: [],
    eventTypes: [
      onlineOffer({
        slug: "pregnancy-consultation",
        title: {
          en: "Pregnancy consultation",
          pt: "Consulta de gravidez",
          es: "Consulta de embarazo",
        },
        description: {
          en: "Your questions answered, and a plan for the weeks ahead.",
          pt: "Respostas às suas perguntas e um plano para as próximas semanas.",
          es: "Respuestas a tus preguntas y un plan para las próximas semanas.",
        },
        kind: "clinical",
        durationMinutes: 50,
        priceCents: 5500,
        languages: ["pt", "en"],
        countries: ["PT"],
        phone: true,
      }),
      onlineOffer({
        slug: "birth-plan",
        title: {
          en: "Birth plan session",
          pt: "Sessão de plano de parto",
          es: "Sesión de plan de parto",
        },
        description: {
          en: "We write your birth plan together, in words your team will follow.",
          pt: "Escrevemos juntas o seu plano de parto, claro para a sua equipa.",
          es: "Escribimos juntas tu plan de parto, claro para tu equipo.",
        },
        kind: "non_clinical",
        durationMinutes: 75,
        priceCents: 7000,
        languages: ["pt", "en"],
        countries: ["PT"],
      }),
    ],
  },
  {
    user: { email: "joana.lima@example.test", name: "Joana Lima" },
    org: { slug: "joanalima", name: "Joana Lima" },
    profile: {
      username: "joanalima",
      displayName: "Joana Lima",
      languages: ["pt", "en", "es"],
      practiceCountry: "PT",
      serviceCountries: ["PT", "ES"],
      worldwideRemote: false,
    },
    persona: {
      headline: "Nutritionist for fertility, PCOS and pregnancy",
      bio: "I help women eat well for fertility, PCOS and pregnancy without strict diets or long lists of banned foods. We look at your routine, your test results if you have them, and what you enjoy eating, then build a plan around your real week.",
      credentials: [
        {
          title: "MSc in Clinical Nutrition",
          institution: "Universidade do Porto",
          year: 2017,
        },
        {
          title: "BSc in Nutrition Sciences",
          institution: "Universidade Nova de Lisboa",
          year: 2014,
        },
      ],
      categories: ["nutrition", "fertility"],
      portrait: { pexelsId: "14566062", photographer: "Luthfi Ramaditya" },
    },
    licence: {
      professionalBody: "ordem_nutricionistas",
      licenceNumber: "DEMO-3317",
      ersRegistrationNumber: "E000002",
    },
    schedules: [ONLINE_LISBON],
    locations: [],
    eventTypes: [
      onlineOffer({
        slug: "first-consultation",
        title: {
          en: "First nutrition consultation",
          pt: "Primeira consulta de nutrição",
          es: "Primera consulta de nutrición",
        },
        description: {
          en: "A full look at your routine and a plan built around your week.",
          pt: "Uma análise completa da sua rotina e um plano feito para a sua semana.",
          es: "Un repaso completo de tu rutina y un plan hecho para tu semana.",
        },
        kind: "clinical",
        durationMinutes: 60,
        priceCents: 6500,
        languages: ["pt", "en", "es"],
        countries: ["PT", "ES"],
      }),
      onlineOffer({
        slug: "follow-up",
        title: { en: "Follow-up", pt: "Seguimento", es: "Seguimiento" },
        description: {
          en: "We check what worked and adjust the plan.",
          pt: "Vemos o que resultou e ajustamos o plano.",
          es: "Vemos qué ha funcionado y ajustamos el plan.",
        },
        kind: "clinical",
        durationMinutes: 30,
        priceCents: 4000,
        languages: ["pt", "en", "es"],
        countries: ["PT", "ES"],
      }),
    ],
  },
  {
    user: { email: "sofia.costa@example.test", name: "Sofia Costa" },
    org: { slug: "sofiacosta", name: "Sofia Costa" },
    profile: {
      username: "sofiacosta",
      displayName: "Sofia Costa",
      languages: ["pt", "en"],
      practiceCountry: "PT",
      serviceCountries: ["PT"],
      worldwideRemote: false,
    },
    persona: {
      headline: "Perinatal psychologist",
      bio: "I support women through fertility treatment, pregnancy, loss and the months after birth. Sessions are a place to say what you cannot say anywhere else, at your pace. I use cognitive behavioural and compassion-focused approaches.",
      credentials: [
        {
          title: "MSc in Clinical and Health Psychology",
          institution: "Universidade de Lisboa",
          year: 2015,
        },
        {
          title: "Training in perinatal mental health",
          institution: "Ordem dos Psicólogos Portugueses",
          year: 2020,
        },
      ],
      categories: ["psychology", "fertility"],
      portrait: { pexelsId: "14156484", photographer: "Shazard R." },
    },
    licence: {
      professionalBody: "ordem_psicologos",
      licenceNumber: "DEMO-4096",
      ersRegistrationNumber: "E000003",
    },
    schedules: [ONLINE_LISBON],
    locations: [],
    eventTypes: [
      onlineOffer({
        slug: "therapy-session",
        title: {
          en: "Therapy session",
          pt: "Sessão de psicoterapia",
          es: "Sesión de terapia",
        },
        description: {
          en: "A 50-minute session by video, at the same time each week if you like.",
          pt: "Uma sessão de 50 minutos por vídeo, à mesma hora todas as semanas se quiser.",
          es: "Una sesión de 50 minutos por vídeo, a la misma hora cada semana si quieres.",
        },
        kind: "clinical",
        durationMinutes: 50,
        priceCents: 6000,
        languages: ["pt", "en"],
        countries: ["PT"],
      }),
    ],
  },
  {
    user: { email: "yasmin.haddad@example.test", name: "Yasmin Haddad" },
    org: { slug: "yasminhaddad", name: "Yasmin Haddad" },
    profile: {
      username: "yasminhaddad",
      displayName: "Dr. Yasmin Haddad",
      languages: ["en", "es", "pt"],
      practiceCountry: "PT",
      serviceCountries: ["PT", "ES"],
      worldwideRemote: false,
    },
    persona: {
      headline: "Family doctor with a focus on menopause",
      bio: "I am a family doctor who spends most of her week on perimenopause and menopause. We go through your symptoms, your history and your options, including hormone therapy and what else can help, so you can decide with the full picture.",
      credentials: [
        {
          title: "Specialist in General and Family Medicine",
          institution: "Ordem dos Médicos",
          year: 2014,
        },
        {
          title: "Menopause care certificate",
          institution: "European Menopause and Andropause Society",
          year: 2021,
        },
      ],
      categories: ["wellness", "pelvic-health"],
      portrait: { pexelsId: "37272329", photographer: "Layth Mushreq" },
    },
    licence: {
      professionalBody: "ordem_medicos",
      licenceNumber: "DEMO-5120",
      ersRegistrationNumber: "E000004",
    },
    schedules: [ONLINE_LISBON],
    locations: [],
    eventTypes: [
      onlineOffer({
        slug: "menopause-consultation",
        title: {
          en: "Menopause consultation",
          pt: "Consulta de menopausa",
          es: "Consulta de menopausia",
        },
        description: {
          en: "Your symptoms and options, explained, with a written summary after.",
          pt: "Os seus sintomas e opções, explicados, com um resumo escrito no fim.",
          es: "Tus síntomas y opciones, explicados, con un resumen escrito al final.",
        },
        kind: "clinical",
        durationMinutes: 45,
        priceCents: 8000,
        languages: ["en", "es", "pt"],
        countries: ["PT", "ES"],
      }),
    ],
  },
  {
    user: { email: "clara.neves@example.test", name: "Clara Neves" },
    org: { slug: "claraneves", name: "Clara Neves" },
    profile: {
      username: "claraneves",
      displayName: "Clara Neves",
      languages: ["pt"],
      practiceCountry: "PT",
      serviceCountries: ["PT"],
      worldwideRemote: false,
    },
    persona: {
      headline: "Lactation consultant",
      bio: "Breastfeeding support for the first days and weeks, by video or phone. We look at latch, feeding positions and how you are feeling, and make a plan for the next few days.",
      credentials: [
        {
          title: "Specialist nurse in maternal and obstetric health",
          institution: "Escola Superior de Enfermagem do Porto",
          year: 2011,
        },
      ],
      categories: ["lactation"],
      portrait: null,
    },
    licence: {
      professionalBody: "ordem_enfermeiros",
      licenceNumber: "DEMO-6144",
      ersRegistrationNumber: "E000005",
    },
    schedules: [ONLINE_LISBON],
    locations: [],
    eventTypes: [
      onlineOffer({
        slug: "breastfeeding-support",
        title: {
          en: "Breastfeeding support",
          pt: "Apoio à amamentação",
          es: "Apoyo a la lactancia",
        },
        description: {
          en: "Help with latch, positions and a plan for the next few days.",
          pt: "Ajuda com a pega, as posições e um plano para os próximos dias.",
          es: "Ayuda con el agarre, las posturas y un plan para los próximos días.",
        },
        kind: "clinical",
        durationMinutes: 45,
        priceCents: 4500,
        languages: ["pt"],
        countries: ["PT"],
        phone: true,
      }),
    ],
  },
]
