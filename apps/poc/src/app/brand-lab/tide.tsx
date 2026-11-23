import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
  SealCheckIcon,
} from "@eleva/icons"
import {
  AREAS,
  CHECKS,
  COPY,
  EXPERTS,
  FAQ,
  FOOTER,
  LEGAL,
  NEEDS,
  QUOTE,
  STEPS,
  photo,
  portrait,
} from "./content"
import { LabLogo } from "./lab-bar"

/**
 * Direction A, Tide: sand and deep teal, Fraunces with one italic phrase,
 * arch frames, one deep field. Evolves today's identity.
 */
export function TideHome() {
  return (
    <>
      <header className="td-nav bl-wrap">
        <LabLogo />
        <nav aria-label="Main">
          <a href="#experts">Find care</a>
          <a href="#how">How it works</a>
          <a href="#close">For experts</a>
        </nav>
        <div className="td-nav-actions">
          <a href="#experts" className="td-signin">
            Sign in
          </a>
          <a href="#experts" className="bl-btn">
            Find an expert
          </a>
        </div>
      </header>

      <main>
        <section className="td-hero bl-wrap">
          <div className="td-hero-text">
            <h1>
              {COPY.heading} <em>{COPY.headingAccent}</em>
            </h1>
            <p className="td-lead">{COPY.lead}</p>
            <form className="td-search" role="search">
              <MagnifyingGlassIcon aria-hidden />
              <input
                type="search"
                aria-label={COPY.searchLabel}
                placeholder={COPY.searchLabel}
              />
              <button type="button" className="bl-btn">
                {COPY.searchAction}
              </button>
            </form>
            <ul className="td-chips" aria-label="Areas of care">
              {NEEDS.map((need) => (
                <li key={need}>
                  <a href="#areas" className="bl-chip">
                    {need}
                  </a>
                </li>
              ))}
            </ul>
            <p className="td-proof">
              <SealCheckIcon weight="fill" aria-hidden />
              {COPY.proof}
            </p>
          </div>
          <div className="td-hero-art" aria-hidden>
            <div className="td-arch td-arch-lg">
              <img src={photo("pregnancy-home")} alt="" />
            </div>
            <div className="td-arch td-arch-sm">
              <img src={photo("support-conversation")} alt="" />
            </div>
            <div className="td-float">
              <span className="td-float-face">
                <img src={portrait(EXPERTS[0].slug)} alt="" />
              </span>
              <span>
                <b>{EXPERTS[0].name}</b>
                <small>{EXPERTS[0].role}</small>
                <small className="td-float-next">
                  Next: {EXPERTS[0].next.toLowerCase()}
                </small>
              </span>
            </div>
          </div>
        </section>

        <section className="td-facts bl-wrap" aria-label="How Eleva works">
          <ul>
            {COPY.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>

        <section className="td-experts bl-wrap" id="experts">
          <div className="td-head">
            <div>
              <h2>{COPY.expertsHeading}</h2>
              <p>{COPY.expertsLead}</p>
            </div>
            <a href="#experts" className="td-link">
              {COPY.expertsAll} <ArrowRightIcon aria-hidden />
            </a>
          </div>
          <ul className="td-cards">
            {EXPERTS.map((expert) => (
              <li key={expert.slug}>
                <a href="#experts" className="td-card">
                  <span className="td-portrait">
                    <img src={portrait(expert.slug)} alt="" />
                  </span>
                  <span className="td-card-body">
                    <b>{expert.name}</b>
                    <span className="td-role">{expert.role}</span>
                    <span className="td-focus">{expert.focus}</span>
                    <span className="td-checked">
                      <SealCheckIcon weight="fill" aria-hidden />
                      Registration checked
                    </span>
                  </span>
                  <span className="td-cells">
                    <span>
                      <small>Next time</small>
                      {expert.next}
                    </span>
                    <span>
                      <small>From</small>
                      {expert.from}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="td-areas bl-wrap" id="areas">
          <div className="td-areas-head">
            <h2>{COPY.areasHeading}</h2>
            <p>{COPY.areasLead}</p>
          </div>
          <ul>
            {AREAS.map((area) => (
              <li key={area.name}>
                <a href="#experts">
                  <b>{area.name}</b>
                  <span>{area.line}</span>
                  <ArrowRightIcon aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="td-deep">
          <div className="bl-wrap">
            <h2>{COPY.checksHeading}</h2>
            <ol>
              {CHECKS.map((check) => (
                <li key={check.title}>
                  <b>{check.title}</b>
                  <p>{check.line}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="td-how bl-wrap" id="how">
          <h2>{COPY.howHeading}</h2>
          <ol>
            <li>
              <div className="td-ui" aria-hidden>
                <span className="td-ui-face">
                  <img src={portrait(EXPERTS[1].slug)} alt="" />
                </span>
                <span>
                  <b>{EXPERTS[1].name}</b>
                  <small>
                    {EXPERTS[1].role} · from {EXPERTS[1].from}
                  </small>
                </span>
              </div>
              <b>{STEPS[0].title}</b>
              <p>{STEPS[0].line}</p>
            </li>
            <li>
              <div className="td-ui td-ui-times" aria-hidden>
                <span>09:00</span>
                <span data-on>10:30</span>
                <span>11:15</span>
                <span>14:00</span>
              </div>
              <b>{STEPS[1].title}</b>
              <p>{STEPS[1].line}</p>
            </li>
            <li>
              <div className="td-ui td-ui-join" aria-hidden>
                <span>
                  <b>Thursday, 10:30</b>
                  <small>Video session · 50 min</small>
                </span>
                <span className="td-ui-btn">Join</span>
              </div>
              <b>{STEPS[2].title}</b>
              <p>{STEPS[2].line}</p>
            </li>
          </ol>
        </section>

        <section className="td-quote bl-wrap">
          <div className="td-arch td-quote-face" aria-hidden>
            <img src={photo("team-kari-bo")} alt="" />
          </div>
          <figure>
            <blockquote>{QUOTE.text}</blockquote>
            <figcaption>
              <b>{QUOTE.name}</b>
              <span>{QUOTE.role}</span>
            </figcaption>
          </figure>
        </section>

        <section className="td-faq bl-wrap">
          <div>
            <h2>{COPY.faqHeading}</h2>
            <p>{COPY.faqHelp}</p>
            <a href="#close" className="td-link">
              {COPY.faqHelpAction} <ArrowRightIcon aria-hidden />
            </a>
          </div>
          <div className="td-faq-list">
            {FAQ.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="td-close bl-wrap" id="close">
          <div className="td-door td-door-member">
            <h2>{COPY.closeHeading}</h2>
            <p>{COPY.closeLead}</p>
            <a href="#experts" className="bl-btn">
              {COPY.searchAction}
            </a>
          </div>
          <div className="td-door td-door-expert">
            <h2>{COPY.closeExpertHeading}</h2>
            <p>{COPY.closeExpertLead}</p>
            <a href="#close" className="bl-btn bl-btn-quiet">
              {COPY.closeExpertAction}
            </a>
          </div>
        </section>
      </main>

      <footer className="td-foot">
        <div className="bl-wrap">
          <div className="td-foot-top">
            <div>
              <LabLogo />
              <p>{COPY.company}</p>
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
          <div className="td-foot-legal">
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
