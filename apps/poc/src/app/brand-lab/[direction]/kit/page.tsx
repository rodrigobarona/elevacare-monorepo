import { notFound } from "next/navigation"
import { ShieldCheckIcon, SealCheckIcon } from "@eleva/icons"
import { DIRECTIONS, EXPERTS, isDirection, portrait } from "../../content"
import { EstuaryKit } from "../../estuary-kit"
import { LabBar, LabLogo } from "../../lab-bar"

export function generateStaticParams() {
  return DIRECTIONS.map((direction) => ({ direction: direction.id }))
}

const SERVICES = [
  {
    name: "First visit",
    meta: "50 min · Video or in person",
    line: "We talk through what is happening, and you leave with a plan you can follow at home.",
    price: "€60",
  },
  {
    name: "Follow-up",
    meta: "30 min · Video",
    line: "We look at what changed and adjust your plan.",
    price: "€45",
  },
] as const

const DAYS = [
  { day: "Tue", date: "24" },
  { day: "Wed", date: "25", on: true },
  { day: "Thu", date: "26" },
  { day: "Fri", date: "27" },
  { day: "Mon", date: "30" },
] as const

const TIMES = ["09:00", "10:30", "11:15", "14:00", "15:30", "17:00"] as const

/**
 * The same profile and pay step in each direction: how the brand carries
 * from the homepage into choosing a person and paying her.
 */
export default async function BrandKitPage({
  params,
}: {
  params: Promise<{ direction: string }>
}) {
  const { direction } = await params
  if (!isDirection(direction)) notFound()
  const expert = EXPERTS[0]
  if (direction === "estuary" || direction === "voices") {
    return (
      <div className="bl" data-direction={direction}>
        <LabBar current={direction} view="kit" />
        <EstuaryKit
          faces={direction === "voices" ? "faces-colour" : "faces"}
          home={`/brand-lab/${direction}`}
        />
      </div>
    )
  }
  return (
    <div className="bl" data-direction={direction}>
      <LabBar current={direction} view="kit" />
      <header className="kit-nav bl-wrap">
        <LabLogo />
        <span>
          <ShieldCheckIcon aria-hidden /> Secure booking
        </span>
      </header>

      <main className="kit bl-wrap">
        <section className="kit-profile" aria-label="Expert profile">
          <div className="kit-id">
            <span className="kit-portrait">
              <img src={portrait(expert.slug)} alt="" />
            </span>
            <div>
              <h1>{expert.name}</h1>
              <p className="kit-role">{expert.role}</p>
              <p className="kit-checked">
                <SealCheckIcon weight="fill" aria-hidden />
                Registration checked with the Ordem dos Fisioterapeutas
              </p>
              <ul className="kit-facts">
                <li>Portuguese, English, Spanish</li>
                <li>Video or in person</li>
                <li>Lisbon</li>
              </ul>
            </div>
          </div>
          <p className="kit-bio">
            I am a physiotherapist specialised in pelvic health. I see women in
            pregnancy, after birth and through menopause for leaking, pain and
            getting back to sport.
          </p>
          <h2>Services</h2>
          <ul className="kit-services">
            {SERVICES.map((service, index) => (
              <li key={service.name} data-on={index === 0 || undefined}>
                <div>
                  <b>{service.name}</b>
                  <small>{service.meta}</small>
                  <p>{service.line}</p>
                </div>
                <span>{service.price}</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="kit-book" aria-label="Choose a time">
          <h2>Choose a time</h2>
          <p className="kit-zone">Times in Lisbon (WET)</p>
          <ul className="kit-days">
            {DAYS.map((day) => (
              <li key={day.date} data-on={"on" in day || undefined}>
                <small>{day.day}</small>
                {day.date}
              </li>
            ))}
          </ul>
          <ul className="kit-times">
            {TIMES.map((time) => (
              <li key={time} data-on={time === "10:30" || undefined}>
                {time}
              </li>
            ))}
          </ul>
          <div className="kit-summary">
            <dl>
              <div>
                <dt>First visit with {expert.name}</dt>
                <dd>€60.00</dd>
              </div>
              <div>
                <dt>Wednesday 25 November, 10:30</dt>
                <dd>50 min</dd>
              </div>
              <div className="kit-total">
                <dt>Total today</dt>
                <dd>€60.00</dd>
              </div>
            </dl>
            <p>Free to cancel until Tuesday 24 November, 10:30.</p>
          </div>
          <label className="kit-field">
            <span>Email</span>
            <input type="email" defaultValue="leonor@example.test" />
          </label>
          <button type="button" className="bl-btn kit-pay">
            Confirm and pay €60.00
          </button>
          <p className="kit-secure">
            <ShieldCheckIcon aria-hidden /> Your card details go straight to our
            payment provider. Eleva never sees them.
          </p>
        </aside>
      </main>
    </div>
  )
}
