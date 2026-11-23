import { ArrowRightIcon, SealCheckIcon } from "@eleva/icons"
import { FOOTER, LEGAL } from "./content"
import { ES_EXPERTS } from "./estuary"
import { HeroFilm } from "./hero-film"
import { HeroQuestions } from "./hero-questions"
import { LabLogo } from "./lab-bar"

/**
 * Direction E, In her words. Made with Anthropic's frontend-design skill
 * after the founder found the earlier directions short on character and too
 * reliant on type. The page is built from what women ask: the hero is the
 * film with one question and one action, need-first browsing is a list of
 * questions, and each expert speaks in her own words. Colour is two fields,
 * each used once: deep teal for how experts are checked, coral for the
 * closing block. There is no accent phrase, no label above a heading, no
 * numbered marker and no gradient.
 *
 * Second pass, after the third blind panel (2026-11-23): the hero's action
 * no longer changes, its words sit on a panel that holds contrast on every
 * clip, experts are three equal cards with the facts a member compares, the
 * steps show the product, and the page ends in a block of its own.
 */

/**
 * Every portrait is cut out of its background and set on one sand field, at
 * one face size. Experts upload their own photographs, so this is the rule
 * that makes them one set (the fourth blind panel's first finding). A tight
 * crop that touches three edges of its frame cannot be cut out well; the
 * real upload step needs to ask for head and shoulders with room above.
 */
const cutout = (slug: string) => `/brand-lab/cutouts/${slug}.webp`

/** The first four show on a phone, so they cover four different moments of life. */
const ASKS = [
  {
    ask: "Is it normal to leak when I laugh?",
    to: "Pelvic health physiotherapists",
  },
  { ask: "What goes in a birth plan?", to: "Midwives" },
  {
    ask: "Why am I awake at three again?",
    to: "Doctors who work with menopause",
  },
  { ask: "Why don't I feel like myself?", to: "Psychologists" },
  { ask: "Is my baby getting enough milk?", to: "Nurses and midwives" },
  { ask: "What should I eat while trying for a baby?", to: "Nutritionists" },
  {
    ask: "When can I run again after giving birth?",
    to: "Pelvic health physiotherapists",
  },
  {
    ask: "How do I ease back pain in pregnancy?",
    to: "Physiotherapists and midwives",
  },
] as const

const PEOPLE: Record<string, { says: string; body: string }> = {
  fisiomota: {
    says: "On a first visit we mostly talk. You go home with a plan you can follow.",
    body: "Ordem dos Fisioterapeutas",
  },
  joanalima: {
    says: "No strict diets and no long lists of banned foods. We build a plan around your real week.",
    body: "Ordem dos Nutricionistas",
  },
  yasminhaddad: {
    says: "We look at what is changing for you, and at what would help.",
    body: "Ordem dos Médicos",
  },
}

const PROFESSIONS = [
  "Physiotherapists",
  "Midwives",
  "Nurses",
  "Nutritionists",
  "Psychologists",
  "Doctors",
] as const

const BODIES = [
  "Ordem dos Fisioterapeutas",
  "Ordem dos Enfermeiros",
  "Ordem dos Nutricionistas",
  "Ordem dos Psicólogos",
  "Ordem dos Médicos",
] as const

const ADVISORS = [
  {
    slug: "kari-bo",
    name: "Kari Bø, PT, PhD",
    role: "Pelvic floor health",
    place: "Norwegian School of Sport Sciences",
  },
  {
    slug: "jenny-bagwell",
    name: "Jenny Bagwell, PT, PhD, DPT",
    role: "Biomechanics and perinatal health",
    place: "California State University, Long Beach",
  },
  {
    slug: "cristine-homsi-jorge",
    name: "Cristine Homsi Jorge, PT, PhD",
    role: "Women's health",
    place: "University of São Paulo",
  },
] as const

const FAQ = [
  {
    q: "Do I need an account to book?",
    a: "No. Choose a time, add your email and pay. Everything you need arrives in your confirmation email.",
  },
  {
    q: "Who are the experts?",
    a: "Physiotherapists, midwives, nurses, nutritionists, psychologists and doctors who work in women's health.",
  },
  {
    q: "How much does it cost?",
    a: "Each expert sets her own price. A first visit is usually between €50 and €70, and the price is on her page.",
  },
  {
    q: "How does a session work?",
    a: "It depends on the expert: some meet by video or phone, some in person, some both. Her page says which.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Before you pay, you see the last day you can cancel without charge.",
  },
] as const

const NAV = [
  { label: "Experts", href: "#experts" },
  { label: "How it works", href: "#session" },
  { label: "For experts", href: "#close" },
  { label: "Sign in", href: "#experts" },
] as const

export function VoicesHome() {
  const ORDER = ["joanalima", "fisiomota", "yasminhaddad"] // soonest free time first
  const people = ORDER.flatMap((slug) =>
    ES_EXPERTS.filter((expert) => expert.slug === slug)
  )
  return (
    <>
      <a href="#asks" className="vo-skip">
        Skip to the questions
      </a>
      <section className="vo-hero">
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
        {/* After the action in the page, so the pause control follows it for a keyboard. */}
        <HeroFilm className="vo-film" />
        <small className="vo-posed">Posed by models</small>
      </section>

      <main>
        <section className="vo-asks bl-wrap" id="asks">
          <h2>What do you want to ask?</h2>
          <ul>
            {ASKS.map((item) => (
              <li key={item.ask}>
                <a href="#experts">
                  <span>{item.ask}</span>
                  <small>{item.to}</small>
                  <ArrowRightIcon aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          <div className="vo-profs">
            <span>Or go by profession</span>
            <ul>
              {PROFESSIONS.map((profession) => (
                <li key={profession}>
                  <a href="#experts">{profession}</a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="vo-experts bl-wrap" id="experts">
          <div className="vo-head">
            <div>
              <h2>The people who answer</h2>
              <p>Three experts with time free this week, soonest first.</p>
            </div>
            <a href="#experts" className="vo-link">
              See all experts
            </a>
          </div>
          <ul className="vo-people">
            {people.map((expert) => (
              <li key={expert.slug}>
                <a href="#experts" className="vo-person">
                  <span className="vo-photo">
                    <img src={cutout(expert.slug)} alt="" />
                  </span>
                  <q>{PEOPLE[expert.slug]?.says}</q>
                  <span className="vo-who">
                    <b>{expert.name}</b>
                    <span>{expert.role}</span>
                    <small>
                      <SealCheckIcon weight="fill" aria-hidden />
                      Registered with the {PEOPLE[expert.slug]?.body}
                    </small>
                  </span>
                  <span className="vo-cells">
                    <span>
                      <small>Next free</small>
                      {expert.next}
                    </span>
                    <span>
                      <small>First visit</small>
                      {expert.first}
                    </span>
                  </span>
                  <span className="vo-go">See her times</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="vo-checked" id="checked">
          <div className="bl-wrap">
            <div>
              <SealCheckIcon weight="fill" aria-hidden />
              <h2>
                Every expert here is registered with her professional body. We
                check that before her profile goes live.
              </h2>
              <p>In Portugal: {BODIES.join(", ")}.</p>
            </div>
            <ul>
              <li>
                <b>She runs her own practice</b>
                You book her and you talk with her directly.
              </li>
              <li>
                <b>You see the price first</b>
                It is on her card, before you choose a time.
              </li>
            </ul>
          </div>
        </section>

        <section className="vo-session bl-wrap" id="session">
          <h2>How booking works</h2>
          <ol>
            <li>
              <div className="vo-ui vo-ui-times" aria-hidden>
                <small>Wednesday 25 November · Lisbon time</small>
                <span>09:00</span>
                <span data-on>10:30</span>
                <span>11:15</span>
                <span>14:00</span>
                <span>15:30</span>
                <span>17:00</span>
              </div>
              <span className="vo-step">First</span>
              <b>You pick a time</b>
              <p>You pay when you book.</p>
            </li>
            <li>
              <div className="vo-ui vo-ui-mail" aria-hidden>
                <small>Your confirmation email</small>
                <b>Wednesday, 10:30</b>
                <small>Video session with Inês Mota · 50 min</small>
                <span>Join the session</span>
              </div>
              <span className="vo-step">Then</span>
              <b>She meets you</b>
              <p>
                A video session opens from the link in your email. In person,
                you go to her.
              </p>
            </li>
            <li>
              <div className="vo-ui vo-ui-next" aria-hidden>
                <small>With Inês Mota</small>
                <b>Follow-up</b>
                <small>30 min · €45</small>
                <span>Book again</span>
              </div>
              <span className="vo-step">After</span>
              <b>You decide what comes next</b>
              <p>Book a follow-up with her, or don&apos;t.</p>
            </li>
          </ol>
          <a href="#experts" className="bl-btn">
            See the experts
          </a>
        </section>

        <section className="vo-advisors">
          <div className="bl-wrap">
            <div>
              <h2>Guided by people who study women&apos;s health</h2>
              <p>
                Three researchers advise Eleva on the evidence. Your care comes
                from the expert you choose.
              </p>
              <a href="#close" className="vo-link">
                Meet the advisors
              </a>
            </div>
            <ul>
              {ADVISORS.map((advisor) => (
                <li key={advisor.slug}>
                  <span className="vo-photo">
                    <img src={cutout(advisor.slug)} alt="" />
                  </span>
                  <span>
                    <b>{advisor.name}</b>
                    <span>{advisor.role}</span>
                    <span>{advisor.place}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
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

        <section className="vo-close" id="close">
          <div className="bl-wrap">
            <div>
              <h2>Not sure who to ask?</h2>
              <p>Start with the experts who are free this week.</p>
              <a href="#experts" className="bl-btn">
                See the experts
              </a>
            </div>
            <div>
              <b>Are you a health professional?</b>
              <p>Set your own prices and see members on your own terms.</p>
              <a href="#close" className="vo-door">
                Offer care on Eleva
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="vo-foot">
        <div className="bl-wrap">
          <div className="vo-foot-top">
            <p>
              Eleva Care is run by Búzios e Tartarugas, Lda, a company
              registered in Portugal.
            </p>
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
          <LabLogo className="vo-wordmark" />
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
