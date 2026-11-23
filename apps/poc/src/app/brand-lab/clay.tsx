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
  QUOTE,
  STEPS,
  portrait,
} from "./content"
import { LabLogo } from "./lab-bar"

const SHAPES = ["arch", "disc", "arch", "disc"] as const
const FIELDS = ["marigold", "lilac", "clay", "marigold"] as const
const TILES = ["lilac", "cream", "marigold", "cream"] as const

/**
 * Direction B, Clay and Aubergine: blush, terracotta and aubergine, a
 * grotesque display face, a shape system, colour fields in place of cards.
 */
export function ClayHome() {
  return (
    <>
      <header className="cl-nav bl-wrap">
        <LabLogo />
        <nav aria-label="Main">
          <a href="#experts">Find care</a>
          <a href="#how">How it works</a>
          <a href="#close">For experts</a>
        </nav>
        <div className="cl-nav-actions">
          <a href="#experts" className="cl-signin">
            Sign in
          </a>
          <a href="#experts" className="bl-btn">
            Find an expert
          </a>
        </div>
      </header>

      <main>
        <section className="cl-hero bl-wrap">
          <div className="cl-hero-text">
            <h1>
              {COPY.heading} <em>{COPY.headingAccent}</em>
            </h1>
            <p className="cl-lead">{COPY.lead}</p>
            <form className="cl-search" role="search">
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
            <p className="cl-proof">
              <SealCheckIcon weight="fill" aria-hidden />
              {COPY.proof}
            </p>
          </div>
          <div className="cl-cluster" aria-hidden>
            <span className="cl-shape cl-shape-arch" data-field="marigold">
              <img src={portrait("joanalima")} alt="" />
            </span>
            <span className="cl-shape cl-shape-disc" data-field="lilac">
              <img src={portrait("fisiomota")} alt="" />
            </span>
            <span className="cl-shape cl-shape-half" data-field="clay" />
            <span className="cl-shape cl-shape-leaf" data-field="aubergine" />
            <span className="cl-shape cl-shape-arch" data-field="lilac">
              <img src={portrait("sofiacosta")} alt="" />
            </span>
            <span className="cl-shape cl-shape-disc" data-field="marigold" />
          </div>
        </section>

        <section className="cl-needs bl-wrap" id="areas">
          <h2>{COPY.searchLabel}</h2>
          <ul>
            {AREAS.map((area, index) => (
              <li key={area.name}>
                <a
                  href="#experts"
                  data-field={TILES[(index + (index > 3 ? 1 : 0)) % 4]}
                >
                  <b>{area.name}</b>
                  <span>{area.line}</span>
                  <ArrowRightIcon aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          <ul className="cl-facts">
            {COPY.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>

        <section className="cl-experts" id="experts">
          <div className="bl-wrap">
            <div className="cl-head">
              <div>
                <h2>{COPY.expertsHeading}</h2>
                <p>{COPY.expertsLead}</p>
              </div>
              <a href="#experts" className="cl-link">
                {COPY.expertsAll} <ArrowRightIcon aria-hidden />
              </a>
            </div>
            <ul className="cl-cards">
              {EXPERTS.map((expert, index) => (
                <li key={expert.slug}>
                  <a href="#experts" className="cl-card">
                    <span
                      className={`cl-shape cl-shape-${SHAPES[index]}`}
                      data-field={FIELDS[index]}
                    >
                      <img src={portrait(expert.slug)} alt="" />
                    </span>
                    <b>{expert.name}</b>
                    <span className="cl-role">{expert.role}</span>
                    <span className="cl-focus">{expert.focus}</span>
                    <span className="cl-checked">
                      <SealCheckIcon weight="fill" aria-hidden />
                      Registration checked
                    </span>
                    <span className="cl-cells">
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
          </div>
        </section>

        <section className="cl-deep">
          <div className="bl-wrap">
            <span
              className="cl-shape cl-shape-leaf cl-deep-shape"
              aria-hidden
            />
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

        <section className="cl-how bl-wrap" id="how">
          <h2>{COPY.howHeading}</h2>
          <ol>
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span
                  className={`cl-shape cl-shape-${["disc", "arch", "leaf"][index]} cl-step`}
                  data-field={["marigold", "lilac", "clay"][index]}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <b>{step.title}</b>
                <p>{step.line}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="cl-quote">
          <figure className="bl-wrap">
            <blockquote>{QUOTE.text}</blockquote>
            <figcaption>
              <b>{QUOTE.name}</b>
              <span>{QUOTE.role}</span>
            </figcaption>
          </figure>
        </section>

        <section className="cl-faq bl-wrap">
          <div>
            <h2>{COPY.faqHeading}</h2>
            <p>{COPY.faqHelp}</p>
            <a href="#close" className="cl-link">
              {COPY.faqHelpAction} <ArrowRightIcon aria-hidden />
            </a>
          </div>
          <div className="cl-faq-list">
            {FAQ.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="cl-close bl-wrap" id="close">
          <div className="cl-door cl-door-member">
            <h2>{COPY.closeHeading}</h2>
            <p>{COPY.closeLead}</p>
            <a href="#experts" className="bl-btn cl-btn-invert">
              {COPY.searchAction}
            </a>
            <span
              className="cl-shape cl-shape-disc cl-door-shape"
              aria-hidden
            />
          </div>
          <div className="cl-door cl-door-expert">
            <h2>{COPY.closeExpertHeading}</h2>
            <p>{COPY.closeExpertLead}</p>
            <a href="#close" className="bl-btn bl-btn-quiet">
              {COPY.closeExpertAction}
            </a>
          </div>
        </section>
      </main>

      <footer className="cl-foot">
        <div className="bl-wrap">
          <div className="cl-foot-top">
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
          <div className="cl-foot-legal">
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
