import Link from "next/link"
import { DIRECTIONS, type DirectionId } from "./content"

/** The strip above every lab page: which direction this is, and the others. */
export function LabBar({
  current,
  view,
}: {
  current: DirectionId
  view: "home" | "kit"
}) {
  return (
    <div className="bl-labbar" data-lab-bar>
      <span className="bl-labbar-title">
        <Link href="/brand-lab">Brand lab</Link> · demo data
      </span>
      <nav aria-label="Brand directions">
        {DIRECTIONS.map((direction) => (
          <Link
            key={direction.id}
            href={`/brand-lab/${direction.id}${view === "kit" ? "/kit" : ""}`}
            aria-current={direction.id === current ? "page" : undefined}
          >
            {direction.letter} · {direction.name}
          </Link>
        ))}
      </nav>
      <Link
        className="bl-labbar-view"
        href={`/brand-lab/${current}${view === "kit" ? "" : "/kit"}`}
      >
        {view === "kit" ? "Homepage" : "Profile and checkout"}
      </Link>
    </div>
  )
}

export function LabLogo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Eleva Care"
      className={["bl-logo", className].filter(Boolean).join(" ")}
    />
  )
}
