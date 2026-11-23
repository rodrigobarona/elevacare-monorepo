import "./brand-lab.css"
import { labFontVariables } from "./fonts"

export const metadata = {
  title: "Eleva brand lab",
  description:
    "Three brand directions for the public site, on the same homepage.",
}

export default function BrandLabLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className={labFontVariables}>{children}</div>
}
