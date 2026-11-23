/**
 * One set of words and people for all three directions, so the comparison is
 * about design only. The experts are the fictional demo seed
 * (`packages/db/src/seed/offer-fixture-specs.ts`); times and prices here are
 * made up for the lab.
 */
export const DIRECTIONS = [
  {
    id: "tide",
    letter: "A",
    name: "Tide",
    line: "Warm paper and deep sea. The Eleva people know, with more depth and one clear voice.",
  },
  {
    id: "clay",
    letter: "B",
    name: "Clay and Aubergine",
    line: "Grounded and warm, with no clinical blue-green and no pink. A clear change of colour.",
  },
  {
    id: "folio",
    letter: "C",
    name: "Folio",
    line: "A well-edited health journal you can book from. Led by type, with few pictures.",
  },
  {
    id: "estuary",
    letter: "D",
    name: "Estuary",
    line: "What the first blind panel asked for: Folio's type and discipline, Tide's hero and warmth, the teal the logo already has.",
  },
  {
    id: "voices",
    letter: "E",
    name: "In her words",
    line: "Built from what women ask. The film fills the first screen, the questions do the talking, and colour is two fields: the brand's teal and coral. Revised after the third blind panel.",
  },
] as const

export type DirectionId = (typeof DIRECTIONS)[number]["id"]

export const isDirection = (value: string): value is DirectionId =>
  DIRECTIONS.some((direction) => direction.id === value)

export const COPY = {
  heading: "Women's health experts,",
  headingAccent: "on your schedule.",
  lead: "Book a checked specialist for pregnancy, pelvic health, menopause and more. By video, by phone or in person.",
  searchLabel: "What do you need help with?",
  searchAction: "See experts",
  proof: "Every expert's registration is checked before her profile goes live.",
  facts: [
    "Video, phone or in person",
    "English, Portuguese and Spanish",
    "The price before you book",
  ],
  expertsHeading: "Meet the experts",
  expertsLead:
    "Real people with real training. Each one runs her own practice.",
  expertsAll: "See all experts",
  areasHeading: "Start from what you need",
  areasLead: "Choose an area and see who can help.",
  checksHeading: "How we check experts",
  howHeading: "From first question to first session",
  faqHeading: "Questions, answered",
  faqHelp: "Something else on your mind?",
  faqHelpAction: "Write to us",
  closeHeading: "Not sure where to start?",
  closeLead: "Tell us what is on your mind and see who can help.",
  closeExpertHeading: "Are you a health professional?",
  closeExpertLead: "Set your own prices and see members on your own terms.",
  closeExpertAction: "Offer care on Eleva",
  company:
    "Eleva Care is run by Búzios e Tartarugas, Lda, a company registered in Portugal.",
} as const

export const NEEDS = [
  "Pregnancy",
  "After birth",
  "Pelvic floor",
  "Menopause",
  "Fertility",
  "Nutrition",
  "Mind and mood",
  "Breastfeeding",
] as const

export const AREAS = [
  { name: "Pregnancy", line: "From the first scan to your birth plan." },
  { name: "After birth", line: "Recovery, feeding and the first weeks home." },
  { name: "Pelvic floor", line: "Leaking, pain and getting back to sport." },
  { name: "Menopause", line: "Symptoms, sleep and your options, explained." },
  { name: "Fertility", line: "Support before, during and after treatment." },
  { name: "Nutrition", line: "Eating well for the stage you are in." },
  { name: "Mind and mood", line: "A place to say what is hard to say." },
  { name: "Breastfeeding", line: "Latch, positions and a plan for this week." },
] as const

export const EXPERTS = [
  {
    slug: "fisiomota",
    name: "Inês Mota",
    role: "Pelvic health physiotherapist",
    focus: "Leaking, pain and getting back to sport",
    languages: "PT · EN · ES",
    meets: "Video or in person",
    next: "Tomorrow, 10:30",
    from: "€45",
  },
  {
    slug: "martasousa",
    name: "Marta Sousa",
    role: "Midwife",
    focus: "Birth plans and the first weeks home",
    languages: "PT · EN",
    meets: "Video or phone",
    next: "Thursday, 09:00",
    from: "€55",
  },
  {
    slug: "joanalima",
    name: "Joana Lima",
    role: "Nutritionist",
    focus: "Fertility, PCOS and pregnancy",
    languages: "PT · EN",
    meets: "Video",
    next: "Today, 17:15",
    from: "€50",
  },
  {
    slug: "sofiacosta",
    name: "Sofia Costa",
    role: "Perinatal psychologist",
    focus: "Pregnancy, loss and the months after birth",
    languages: "PT · EN · ES",
    meets: "Video",
    next: "Friday, 14:00",
    from: "€60",
  },
] as const

export const CHECKS = [
  {
    title: "Her registration, checked",
    line: "We confirm each expert's registration with her professional body before her profile goes live.",
  },
  {
    title: "Her own practice",
    line: "Experts on Eleva are independent. You book her, and you talk with her.",
  },
  {
    title: "Clear terms",
    line: "You see the price and the cancellation terms, with their date, before you pay.",
  },
] as const

export const STEPS = [
  {
    title: "Choose your expert",
    line: "See who she is, what she charges and when she is free.",
  },
  {
    title: "Pick a time",
    line: "No account needed. You pay when you book.",
  },
  {
    title: "Meet",
    line: "Join from the link in your email, or go in person.",
  },
] as const

export const QUOTE = {
  text: "Evidence-based pelvic-floor muscle training not only prevents and treats dysfunction; it empowers women to live confidently and fully at every stage of life.",
  name: "Kari Bø, PT, PhD",
  role: "Board advisor, pelvic floor health",
} as const

export const FAQ = [
  {
    q: "Do I need an account to book?",
    a: "No. Choose a time, add your details and pay. Your confirmation email has everything you need.",
  },
  {
    q: "Who are the experts?",
    a: "Independent health professionals: physiotherapists, midwives, nutritionists, psychologists and doctors. We check each registration before a profile goes live.",
  },
  {
    q: "How do sessions happen?",
    a: "By video, by phone or in person, depending on the expert. A video session opens from the link in your email.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Each service shows its cancellation terms, and the date they apply until, before you pay.",
  },
] as const

export const FOOTER = [
  { title: "Care", links: ["Find an expert", "Areas of care", "How it works"] },
  { title: "Learn", links: ["Femme Focus newsletter", "Podcast", "Help"] },
  { title: "Eleva", links: ["About", "For experts", "For clinics"] },
] as const

export const LEGAL = [
  "Privacy",
  "Terms",
  "Cookies",
  "Trust and security",
] as const

export const portrait = (slug: string) => `/brand-lab/portraits/${slug}.jpg`
export const photo = (slug: string) => `/brand-lab/photos/${slug}.jpg`
