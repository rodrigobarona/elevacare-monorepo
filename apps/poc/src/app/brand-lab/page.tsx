import Link from "next/link"
import { DIRECTIONS } from "./content"

const SWATCHES: Record<string, string[]> = {
  tide: ["#F6EFE6", "#0B5A63", "#A8492A", "#0E3338", "#DCE9E3"],
  clay: ["#FBF3EC", "#A23E22", "#3A1830", "#E2A63B", "#E9E0F0"],
  folio: ["#FAF7F0", "#1C3A2E", "#1F5A43", "#F1E1A0", "#E2EBDD"],
  estuary: ["#FAF6EE", "#0B5A63", "#0E3338", "#F1E1A0", "#DCE9E3"],
  voices: ["#F6F8F7", "#006D77", "#0A3A40", "#E29578", "#142326"],
}

/** The lab's front door: three directions, each on the same two pages. */
export default function BrandLabIndex() {
  return (
    <main className="bl-index">
      <p className="bl-index-kicker">Eleva · brand lab · demo data</p>
      <h1>Directions for the public site</h1>
      <p className="bl-index-lead">
        The same homepage, profile and pay step in three directions, A to C,
        with the same words and people, so what you compare is colour, type,
        imagery and shape. D was built after a blind panel scored the first
        three, from what the judges asked for. E came after the founder asked
        for more character and less reliance on type. Nothing here is decided.
      </p>
      <ul>
        {DIRECTIONS.map((direction) => (
          <li key={direction.id}>
            <span className="bl-index-swatches" aria-hidden>
              {SWATCHES[direction.id]?.map((colour) => (
                <i key={colour} style={{ background: colour }} />
              ))}
            </span>
            <h2>
              {direction.letter} · {direction.name}
            </h2>
            <p>{direction.line}</p>
            <span className="bl-index-links">
              <Link href={`/brand-lab/${direction.id}`}>Homepage</Link>
              <Link href={`/brand-lab/${direction.id}/kit`}>
                Profile and pay step
              </Link>
            </span>
          </li>
        ))}
      </ul>
      <p className="bl-index-note">
        Palettes, type sizes and contrast ratios are in{" "}
        <code>docs/eleva-v3/design-audit/brand-directions.md</code>. The experts
        are the fictional demo seed; times and prices are made up.
      </p>
    </main>
  )
}
