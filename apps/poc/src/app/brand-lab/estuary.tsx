import { ArrowRightIcon, SealCheckIcon } from "@eleva/icons"
import { FOOTER, LEGAL, NEEDS, photo } from "./content"
import { LabLogo } from "./lab-bar"

/**
 * Direction D, Estuary: what the first blind panel asked for. Folio's type
 * and discipline (one display moment, hairlines, one radius), steps that
 * show the product, and the teal the logo already has. Words follow the
 * writing judge's rewrites. The hero has one goal, finding an expert: the
 * founder asked for that on 2026-11-23, so the need chips and the first
 * experts come straight after it and not inside it.
 */

export const face = (slug: string) => `/brand-lab/faces/${slug}.jpg`

export const ES_EXPERTS = [
  {
    slug: "fisiomota",
    name: "Inês Mota",
    role: "Pelvic health physiotherapist",
    focus: "Leaking, pain and getting back to sport",
    next: "Tomorrow, 10:30",
    first: "€60",
  },
  {
    slug: "joanalima",
    name: "Joana Lima",
    role: "Nutritionist",
    focus: "Fertility, PCOS and pregnancy",
    next: "Today, 17:15",
    first: "€50",
  },
  {
    slug: "sofiacosta",
    name: "Sofia Costa",
    role: "Perinatal psychologist",
    focus: "Pregnancy, loss and the months after birth",
    next: "Friday, 14:00",
    first: "€60",
  },
  {
    slug: "yasminhaddad",
    name: "Dr. Yasmin Haddad",
    role: "Family doctor",
    focus: "Perimenopause and menopause",
    next: "Monday, 11:30",
    first: "€70",
  },
] as const

const PROMISES = [
  {
    title: "Her registration, checked",
    line: "We confirm each expert's registration with her professional body before her profile goes live.",
  },
  {
    title: "Independent experts",
    line: "Each expert is independent. You book her and talk with her directly.",
  },
  {
    title: "Clear terms",
    line: "You see the price and the cancellation terms, with their date, before you pay.",
  },
] as const

const FAQ = [
  {
    q: "Do I need an account to book?",
    a: "No. Choose a time, add your details and pay. Your confirmation email has everything you need.",
  },
  {
    q: "Who are the experts?",
    a: "Physiotherapists, midwives, nutritionists, psychologists and doctors, each registered with her professional body. We check that registration before a profile goes live.",
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
  { label: "How it works", href: "#how" },
  { label: "For experts", href: "#close" },
  { label: "Sign in", href: "#experts" },
] as const

export function EstuaryHome() {
  return (
    <>
      <header className="es-nav bl-wrap">
        <LabLogo />
        <nav aria-label="Main">
          {NAV.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <details className="es-menu">
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

      <main>
        <section className="es-hero bl-wrap">
          <h1>
            Women&apos;s health experts,{" "}
            <em>
              <span>on your schedule.</span>
            </em>
          </h1>
          <div className="es-hero-row">
            <p className="es-lead">
              Book a registered expert for pregnancy, pelvic health, menopause
              and more. By video, phone or in person.
            </p>
            <form className="es-search" role="search">
              <label htmlFor="es-need">What do you need help with?</label>
              <div>
                <input
                  id="es-need"
                  type="search"
                  placeholder="For example, pelvic floor"
                />
                <button type="button" className="bl-btn">
                  Find an expert
                </button>
              </div>
            </form>
          </div>
        </section>

        <div className="es-plate" aria-hidden>
          <div>
            <img src={photo("postpartum-mother")} alt="" />
          </div>
        </div>

        <section className="es-needs bl-wrap" id="needs">
          <h2>Start from what you need</h2>
          <ul className="es-chips">
            {NEEDS.map((need) => (
              <li key={need}>
                <a href="#experts" className="bl-chip">
                  {need}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="es-experts bl-wrap" id="experts">
          <div className="es-head">
            <h2>Meet the experts</h2>
            <p>Real people with real training.</p>
            <a href="#experts" className="es-link">
              See all experts <ArrowRightIcon aria-hidden />
            </a>
          </div>
          <ul className="es-rows">
            {ES_EXPERTS.map((expert) => (
              <li key={expert.slug}>
                <a href="#experts">
                  <span className="es-face">
                    <img src={face(expert.slug)} alt="" />
                  </span>
                  <span className="es-who">
                    <b>{expert.name}</b>
                    <span>{expert.role}</span>
                    <small>
                      <SealCheckIcon weight="fill" aria-hidden /> Registration
                      checked
                    </small>
                  </span>
                  <span className="es-focus">{expert.focus}</span>
                  <span className="es-cell">
                    <small>Next free</small>
                    {expert.next}
                  </span>
                  <span className="es-cell">
                    <small>First visit</small>
                    {expert.first}
                  </span>
                  <ArrowRightIcon aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="es-deep">
          <div className="bl-wrap">
            <div className="es-deep-photo" aria-hidden>
              <img src={photo("pregnancy-home")} alt="" />
            </div>
            <div>
              <h2>What you can count on</h2>
              <ul>
                {PROMISES.map((promise) => (
                  <li key={promise.title}>
                    <b>{promise.title}</b>
                    <p>{promise.line}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="es-how bl-wrap" id="how">
          <h2>From first question to first session</h2>
          <ol>
            <li>
              <div className="es-ui" aria-hidden>
                <span className="es-face">
                  <img src={face(ES_EXPERTS[1].slug)} alt="" />
                </span>
                <span>
                  <b>{ES_EXPERTS[1].name}</b>
                  <small>{ES_EXPERTS[1].role}</small>
                  <small>First visit {ES_EXPERTS[1].first}</small>
                </span>
              </div>
              <span className="es-step">01</span>
              <b>Choose your expert</b>
              <p>See who she is, what she charges and when she is free.</p>
            </li>
            <li>
              <div className="es-ui es-ui-times" aria-hidden>
                <small>Wednesday 25 November</small>
                <span>09:00</span>
                <span data-on>10:30</span>
                <span>11:15</span>
                <span>14:00</span>
              </div>
              <span className="es-step">02</span>
              <b>Pick a time</b>
              <p>Choose a day and time. You pay when you book.</p>
            </li>
            <li>
              <div className="es-ui es-ui-mail" aria-hidden>
                <small>Your confirmation email</small>
                <b>Wednesday, 10:30</b>
                <small>Video session · 50 min · link inside</small>
              </div>
              <span className="es-step">03</span>
              <b>Meet</b>
              <p>Join from the link in your email, or go in person.</p>
            </li>
          </ol>
        </section>

        <section className="es-advisors bl-wrap">
          <span className="es-face">
            <img src={face("kari-bo")} alt="" />
          </span>
          <div>
            <h2>Guided by people who study women&apos;s health</h2>
            <p>
              Our advisors bring clinical research into how Eleva works. Your
              care comes from the expert you choose.
            </p>
            <p className="es-advisor-name">
              <b>Kari Bø, PT, PhD</b> · Advisor to Eleva, pelvic floor health
            </p>
            <a href="#close" className="es-link">
              Meet the advisors <ArrowRightIcon aria-hidden />
            </a>
          </div>
        </section>

        <section className="es-faq bl-wrap">
          <div className="es-head">
            <h2>Questions, answered</h2>
            <p>Something else on your mind?</p>
            <a href="#close" className="es-link">
              Write to us <ArrowRightIcon aria-hidden />
            </a>
          </div>
          <div className="es-faq-list">
            {FAQ.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="es-close bl-wrap" id="close">
          <div>
            <h2>Not sure where to start?</h2>
            <p>Choose an area, or browse everyone.</p>
            <a href="#experts" className="bl-btn">
              Find an expert
            </a>
          </div>
          <div>
            <h2>Are you a health professional?</h2>
            <p>Set your own prices and see members on your own terms.</p>
            <a href="#close" className="es-link">
              Offer care on Eleva <ArrowRightIcon aria-hidden />
            </a>
          </div>
        </section>
      </main>

      <footer className="es-foot">
        <div className="bl-wrap">
          <div className="es-foot-top">
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
          <LabLogo className="es-wordmark" />
          <div className="es-foot-legal">
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
