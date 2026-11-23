import { SealCheckIcon, ShieldCheckIcon } from "@eleva/icons"
import { ES_EXPERTS } from "./estuary"
import { LabLogo } from "./lab-bar"

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
 * Direction D on the booking path: the profile and the step before payment,
 * with the fixes the first panel asked for (how she meets is chosen and
 * shown, the time zone sits beside the time, the button says what happens
 * next, and a bar on phones keeps the next free time in reach).
 */
export function EstuaryKit({
  faces = "faces",
}: {
  faces?: "faces" | "faces-colour"
}) {
  const expert = ES_EXPERTS[0]
  return (
    <>
      <header className="kit-nav bl-wrap">
        <LabLogo />
        <span>
          <ShieldCheckIcon aria-hidden /> Secure booking
        </span>
      </header>

      <main className="kit ek bl-wrap">
        <section className="kit-profile" aria-label="Expert profile">
          <div className="kit-id">
            <span className="kit-portrait">
              <img src={`/brand-lab/${faces}/${expert.slug}.jpg`} alt="" />
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
                <span>
                  {service.price}
                  {index === 0 ? <small>Selected</small> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="kit-book" id="book" aria-label="Choose a time">
          <h2>Choose a time</h2>
          <fieldset className="ek-mode">
            <legend>How would you like to meet?</legend>
            <span data-on>Video</span>
            <span>In person, Lisbon</span>
          </fieldset>
          <p className="ek-label">Wednesday 25 November · Lisbon time</p>
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
                <dt>Video session, 50&nbsp;min</dt>
                <dd />
              </div>
              <div>
                <dt>Wednesday 25 November, 10:30, Lisbon time</dt>
                <dd />
              </div>
              <div className="kit-total">
                <dt>Total</dt>
                <dd>€60.00</dd>
              </div>
            </dl>
            <p>
              Cancel free until Tuesday 24 November, 10:30. After that the
              session is charged in full.
            </p>
          </div>
          <label className="kit-field">
            <span>Email, for your confirmation and your link</span>
            <input type="email" defaultValue="leonor@example.test" />
          </label>
          <button type="button" className="bl-btn kit-pay">
            Continue to payment · €60.00
          </button>
          <p className="kit-secure">
            <ShieldCheckIcon aria-hidden />
            <span>
              You pay on the next step, and nothing is charged before it. Your
              card details go to our payment provider, never to Eleva.
            </span>
          </p>
          <p className="ek-legal">
            By continuing you agree to the <a href="#book">Terms</a>. The{" "}
            <a href="#book">Privacy notice</a> says how we handle your data.
          </p>
        </aside>
      </main>

      <div className="ek-bar">
        <span>
          <b>First visit · €60</b>
          <small>Next free tomorrow, 10:30</small>
        </span>
        <a href="#book" className="bl-btn">
          Choose a time
        </a>
      </div>
    </>
  )
}
