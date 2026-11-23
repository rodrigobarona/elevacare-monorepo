import { SealCheckIcon } from "@eleva/icons"
import { FOOTER, LEGAL, photo } from "./content"
import { ES_EXPERTS } from "./estuary"
import { HeroFilm } from "./hero-film"
import { HeroQuestions } from "./hero-questions"
import { LabLogo } from "./lab-bar"

/**
 * Direction E, In her words. Made with Anthropic's frontend-design skill
 * after the founder found the earlier directions short on character and too
 * reliant on type. The page is built from what women ask: the hero is the
 * film with one question and one action, need-first browsing is a set of
 * questions, and each expert speaks in her own words. Colour is two fields,
 * the brand's teal and coral. There is no accent phrase, no label above a
 * heading, no numbered marker and no gradient.
 */

const colour = (slug: string) => `/brand-lab/faces-colour/${slug}.jpg`

/** "Tomorrow, 10:30" reads "tomorrow, 10:30" mid-sentence; a weekday keeps its capital. */
const when = (next: string) =>
  /^(Today|Tomorrow)/.test(next)
    ? next.charAt(0).toLowerCase() + next.slice(1)
    : next

const ASKS = [
  "Is this pain normal in pregnancy?",
  "How do I write a birth plan I understand?",
  "When can I run again after the birth?",
  "Is my baby getting enough milk?",
  "Why are my periods changing at 44?",
  "What should I eat with PCOS?",
  "Why don't I feel like myself?",
  "Who do I even ask about this?",
] as const

const SAYS: Record<string, string> = {
  fisiomota:
    "A first visit is a calm conversation and a clear plan you can follow at home.",
  joanalima:
    "No strict diets and no long lists of banned foods. We build a plan around your real week.",
  sofiacosta:
    "Sessions are a place to say what you cannot say anywhere else, at your pace.",
}

const BODIES = [
  "Ordem dos Fisioterapeutas",
  "Ordem dos Enfermeiros",
  "Ordem dos Nutricionistas",
  "Ordem dos Psicólogos",
  "Ordem dos Médicos",
] as const

const MOMENTS = [
  {
    when: "First",
    title: "You pick a time",
    line: "No account needed. You see the price and you pay when you book.",
  },
  {
    when: "Then",
    title: "She meets you",
    line: "At the time you chose, by video, by phone or in person.",
  },
  {
    when: "After",
    title: "You decide what comes next",
    line: "Book a follow-up with her, or don't. It is your call.",
  },
] as const

const ADVISORS = [
  { slug: "kari-bo", name: "Kari Bø, PT, PhD", role: "Pelvic floor health" },
  {
    slug: "jenny-bagwell",
    name: "Jenny Bagwell, PT, PhD, DPT",
    role: "Biomechanics and perinatal health",
  },
  {
    slug: "cristine-homsi-jorge",
    name: "Cristine Homsi Jorge, PT, PhD",
    role: "Women's health",
  },
] as const

const FAQ = [
  {
    q: "Do I need an account to book?",
    a: "No. Choose a time, add your details and pay. Your confirmation email has everything you need.",
  },
  {
    q: "How much does it cost?",
    a: "Each expert sets her own prices. You see the price of a first visit on her page, before you choose a time.",
  },
  {
    q: "How does a session work?",
    a: "By video, by phone or in person, depending on the expert. A video session opens from the link in your email.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Each service shows its cancellation terms, and the date they apply until, before you pay.",
  },
] as const

const NAV = [
  { label: "Find care", href: "#experts" },
  { label: "How it works", href: "#session" },
  { label: "For experts", href: "#close" },
  { label: "Sign in", href: "#experts" },
] as const

export function VoicesHome() {
  const [lead, ...others] = ES_EXPERTS.slice(0, 3)
  return (
    <>
      <section className="vo-hero">
        <HeroFilm className="vo-film" />
        <div className="vo-shade" aria-hidden />
        <header className="vo-nav">
          <LabLogo />
          <nav aria-label="Main">
            {NAV.map((item) => (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <details className="vo-menu">
            <summary>Menu</summary>
            <nav aria-label="Menu">
              {NAV.map((item) => (
                <a key={item.label} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
          </details>
        </header>
        <HeroQuestions />
      </section>

      <main>
        <section className="vo-asks bl-wrap" id="asks">
          <h2>What do you want to ask?</h2>
          <ul>
            {ASKS.map((ask) => (
              <li key={ask}>
                <a href="#experts">{ask}</a>
              </li>
            ))}
          </ul>
        </section>

        <section className="vo-experts bl-wrap" id="experts">
          <div className="vo-head">
            <h2>The people who answer</h2>
            <a href="#experts" className="vo-link">
              See all experts
            </a>
          </div>
          <div className="vo-people">
            {lead ? (
              <a href="#experts" className="vo-person vo-person-lead">
                <span className="vo-photo">
                  <img src={colour(lead.slug)} alt="" />
                </span>
                <span className="vo-person-text">
                  <q>{SAYS[lead.slug]}</q>
                  <b>{lead.name}</b>
                  <span>{lead.role}</span>
                  <span className="vo-when">
                    Free {when(lead.next)}. First visit {lead.first}.
                  </span>
                </span>
              </a>
            ) : null}
            {others.map((expert) => (
              <a key={expert.slug} href="#experts" className="vo-person">
                <span className="vo-photo">
                  <img src={colour(expert.slug)} alt="" />
                </span>
                <span className="vo-person-text">
                  <q>{SAYS[expert.slug]}</q>
                  <b>{expert.name}</b>
                  <span>{expert.role}</span>
                  <span className="vo-when">
                    Free {when(expert.next)}. First visit {expert.first}.
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="vo-checked">
          <div className="bl-wrap">
            <div>
              <SealCheckIcon weight="fill" aria-hidden />
              <h2>
                Every expert here is registered with her professional body. We
                check that before her profile goes live.
              </h2>
              <p>{BODIES.join(", ")}.</p>
            </div>
            <ul>
              <li>
                <b>She runs her own practice</b>
                You book her and you talk with her directly.
              </li>
              <li>
                <b>Nothing is hidden</b>
                You see the price and the cancellation terms, with their date,
                before you pay.
              </li>
            </ul>
          </div>
        </section>

        <section className="vo-session" id="session">
          <div className="bl-wrap">
            <div className="vo-session-photo" aria-hidden>
              <img src={photo("online-session-mature")} alt="" />
            </div>
            <div>
              <h2>What a first session is like</h2>
              <ol>
                {MOMENTS.map((moment) => (
                  <li key={moment.title}>
                    <span>{moment.when}</span>
                    <div>
                      <b>{moment.title}</b>
                      <p>{moment.line}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="vo-advisors bl-wrap">
          <div>
            <h2>Guided by people who study women&apos;s health</h2>
            <p>
              Our advisors bring clinical research into how Eleva works. Your
              care comes from the expert you choose.
            </p>
            <a href="#close" className="vo-link">
              Meet the advisors
            </a>
          </div>
          <ul>
            {ADVISORS.map((advisor) => (
              <li key={advisor.slug}>
                <span className="vo-photo">
                  <img src={colour(advisor.slug)} alt="" />
                </span>
                <b>{advisor.name}</b>
                <span>{advisor.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="vo-faq bl-wrap">
          <h2>Before you book</h2>
          <div>
            {FAQ.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="vo-foot" id="close">
        <div className="bl-wrap">
          <div className="vo-close">
            <div>
              <h2>Not sure who to ask?</h2>
              <p>Choose an area, or look through everyone.</p>
              <a href="#experts" className="bl-btn">
                Find an expert
              </a>
            </div>
            <div>
              <h2>Are you a health professional?</h2>
              <p>Set your own prices and see members on your own terms.</p>
              <a href="#close" className="vo-link">
                Offer care on Eleva
              </a>
            </div>
          </div>
          <div className="vo-foot-top">
            <div>
              <LabLogo />
              <p>
                Eleva Care is run by Búzios e Tartarugas, Lda, a company
                registered in Portugal.
              </p>
            </div>
            {FOOTER.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <b>{column.title}</b>
                {column.links.map((link) => (
                  <a key={link} href="#experts">
                    {link}
                  </a>
                ))}
              </nav>
            ))}
          </div>
          <div className="vo-foot-legal">
            <span>© 2026 Eleva Care</span>
            {LEGAL.map((link) => (
              <a key={link} href="#experts">
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </>
  )
}
