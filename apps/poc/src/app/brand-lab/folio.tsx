import { ArrowRightIcon, SealCheckIcon } from "@eleva/icons"
import {
  AREAS,
  CHECKS,
  COPY,
  EXPERTS,
  FAQ,
  FOOTER,
  LEGAL,
  QUOTE,
  STEPS,
  photo,
  portrait,
} from "./content"
import { LabLogo } from "./lab-bar"

const two = (value: number) => String(value).padStart(2, "0")

/**
 * Direction C, Folio: ivory and forest, Newsreader at display size, numbered
 * rows on hairlines, one large photograph, black and white portraits.
 */
export function FolioHome() {
  return (
    <>
      <header className="fo-nav bl-wrap">
        <LabLogo />
        <nav aria-label="Main">
          <a href="#experts">Find care</a>
          <a href="#how">How it works</a>
          <a href="#close">For experts</a>
          <a href="#experts">Sign in</a>
        </nav>
        <a href="#experts" className="bl-btn">
          Find an expert
        </a>
      </header>

      <main>
        <section className="fo-hero bl-wrap">
          <h1>
            {COPY.heading}{" "}
            <em>
              <span>{COPY.headingAccent}</span>
            </em>
          </h1>
          <div className="fo-hero-row">
            <p className="fo-lead">{COPY.lead}</p>
            <div>
              <form className="fo-search" role="search">
                <input
                  type="search"
                  aria-label={COPY.searchLabel}
                  placeholder={COPY.searchLabel}
                />
                <button type="button" className="bl-btn">
                  {COPY.searchAction}
                </button>
              </form>
              <p className="fo-proof">
                <SealCheckIcon aria-hidden />
                {COPY.proof}
              </p>
            </div>
          </div>
        </section>

        <section className="fo-plate" aria-hidden>
          <div className="fo-plate-photo">
            <img src={photo("postpartum-mother")} alt="" />
          </div>
          <ul className="fo-plate-facts">
            {COPY.facts.map((fact, index) => (
              <li key={fact}>
                <span>{two(index + 1)}</span>
                {fact}
              </li>
            ))}
          </ul>
        </section>

        <section className="fo-experts bl-wrap" id="experts">
          <div className="fo-head">
            <h2>{COPY.expertsHeading}</h2>
            <p>{COPY.expertsLead}</p>
            <a href="#experts" className="fo-link">
              {COPY.expertsAll} <ArrowRightIcon aria-hidden />
            </a>
          </div>
          <ol className="fo-rows">
            {EXPERTS.map((expert, index) => (
              <li key={expert.slug}>
                <a href="#experts">
                  <span className="fo-num">{two(index + 1)}</span>
                  <span className="fo-face">
                    <img src={portrait(expert.slug)} alt="" />
                  </span>
                  <span className="fo-who">
                    <b>{expert.name}</b>
                    <span>{expert.role}</span>
                  </span>
                  <span className="fo-focus">
                    {expert.focus}
                    <small>
                      <SealCheckIcon aria-hidden /> Registration checked
                    </small>
                  </span>
                  <span className="fo-cell">
                    <small>Next time</small>
                    {expert.next}
                  </span>
                  <span className="fo-cell">
                    <small>From</small>
                    {expert.from}
                  </span>
                  <ArrowRightIcon aria-hidden />
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="fo-areas bl-wrap" id="areas">
          <div className="fo-head">
            <h2>{COPY.areasHeading}</h2>
            <p>{COPY.areasLead}</p>
          </div>
          <ul>
            {AREAS.map((area) => (
              <li key={area.name}>
                <a href="#experts">
                  <b>{area.name}</b>
                  <span>{area.line}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="fo-deep">
          <div className="bl-wrap">
            <h2>{COPY.checksHeading}</h2>
            <ol>
              {CHECKS.map((check, index) => (
                <li key={check.title}>
                  <span>{two(index + 1)}</span>
                  <b>{check.title}</b>
                  <p>{check.line}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="fo-how bl-wrap" id="how">
          <h2>{COPY.howHeading}</h2>
          <ol>
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span>{two(index + 1)}</span>
                <b>{step.title}</b>
                <p>{step.line}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="fo-quote bl-wrap">
          <figure>
            <blockquote>{QUOTE.text}</blockquote>
            <figcaption>
              <span className="fo-face">
                <img src={photo("team-kari-bo")} alt="" />
              </span>
              <span>
                <b>{QUOTE.name}</b>
                {QUOTE.role}
              </span>
            </figcaption>
          </figure>
        </section>

        <section className="fo-faq bl-wrap">
          <div className="fo-head">
            <h2>{COPY.faqHeading}</h2>
            <p>{COPY.faqHelp}</p>
            <a href="#close" className="fo-link">
              {COPY.faqHelpAction} <ArrowRightIcon aria-hidden />
            </a>
          </div>
          <div className="fo-faq-list">
            {FAQ.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary>
                  <span>{two(index + 1)}</span>
                  {item.q}
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="fo-close bl-wrap" id="close">
          <div>
            <h2>{COPY.closeHeading}</h2>
            <p>{COPY.closeLead}</p>
            <a href="#experts" className="bl-btn">
              {COPY.searchAction}
            </a>
          </div>
          <div>
            <h2>{COPY.closeExpertHeading}</h2>
            <p>{COPY.closeExpertLead}</p>
            <a href="#close" className="fo-link">
              {COPY.closeExpertAction} <ArrowRightIcon aria-hidden />
            </a>
          </div>
        </section>
      </main>

      <footer className="fo-foot">
        <div className="bl-wrap">
          <div className="fo-foot-top">
            <p>{COPY.company}</p>
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
          <LabLogo className="fo-wordmark" />
          <div className="fo-foot-legal">
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
