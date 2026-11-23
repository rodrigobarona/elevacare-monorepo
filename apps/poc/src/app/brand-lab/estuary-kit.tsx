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
 * Directions D and E on the booking path: the profile and the step before
 * payment, with the fixes the first panel asked for (how she meets is chosen
 * and shown, the time zone sits beside the time, the button says what happens
 * next, and a bar on phones keeps the next free time in reach) and the third
 * panel's (every choice is a real radio button, so the picker works from the
 * keyboard; there is a way back and a way to help; the profile has fixed
 * sections; the summary says who provides the session and who takes payment).
 */
export function EstuaryKit({
  faces = "faces",
  home = "/brand-lab/estuary",
}: {
  faces?: "faces" | "faces-colour"
  home?: string
}) {
  const expert = ES_EXPERTS[0]
  return (
    <>
      <header className="kit-nav bl-wrap">
        <a href={home} aria-label="Eleva Care, home" className="ek-home">
          <LabLogo />
        </a>
        <nav aria-label="Booking">
          <a href={home}>All experts</a>
          <a href="#help">Help</a>
        </nav>
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
                <span>
                  Registered with the Ordem dos Fisioterapeutas. Checked by
                  Eleva in October 2026. <a href="#help">How we check</a>
                </span>
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
          <div className="ek-about">
            <div>
              <h2>How I work</h2>
              <p>
                On a first visit we mostly talk. I ask what is happening and
                what you want to get back to, and we agree on a plan you can
                follow at home.
              </p>
            </div>
            <div>
              <h2>Training</h2>
              <ul>
                <li>Degree in Physiotherapy, Lisbon, 2012</li>
                <li>Postgraduate course in pelvic health, 2015</li>
              </ul>
            </div>
          </div>
          <h2 id="services">Services</h2>
          <ul className="kit-services" aria-labelledby="services">
            {SERVICES.map((service, index) => (
              <li key={service.name}>
                <label>
                  <input
                    type="radio"
                    name="service"
                    defaultChecked={index === 0}
                  />
                  <span>
                    <b>{service.name}</b>
                    <small>{service.meta}</small>
                    <span>{service.line}</span>
                  </span>
                  <span>
                    {service.price}
                    <small>Selected</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <aside className="kit-book" id="book" aria-label="Choose a time">
          <h2>Choose a time</h2>
          <fieldset className="ek-mode">
            <legend>How would you like to meet?</legend>
            <label>
              <input type="radio" name="mode" defaultChecked />
              Video
            </label>
            <label>
              <input type="radio" name="mode" />
              In person, Lisbon
            </label>
          </fieldset>
          <fieldset className="ek-set">
            <legend>Day · November</legend>
            <ul className="kit-days">
              {DAYS.map((day) => (
                <li key={day.date}>
                  <label>
                    <input
                      type="radio"
                      name="day"
                      defaultChecked={"on" in day}
                    />
                    <small>{day.day}</small>
                    {day.date}
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="ek-later">
              Later days
            </button>
          </fieldset>
          <fieldset className="ek-set">
            <legend>Time · Lisbon time</legend>
            <ul className="kit-times">
              {TIMES.map((time) => (
                <li key={time}>
                  <label>
                    <input
                      type="radio"
                      name="time"
                      defaultChecked={time === "10:30"}
                    />
                    {time}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
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
              €60.00 is the full price. Cancel free until Tuesday 24 November,
              10:30. After that the session is charged in full.
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
              Nothing is charged yet. You enter your card on the next step, and
              your card details never reach Eleva.
            </span>
          </p>
          <p className="ek-legal" id="help">
            Inês Mota provides the session as an independent physiotherapist.
            Eleva Care (Búzios e Tartarugas, Lda) takes the payment for her. By
            continuing you agree to the <a href="#book">Terms</a>. The{" "}
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
