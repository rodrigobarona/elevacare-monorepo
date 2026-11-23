import { notFound } from "next/navigation"
import { DIRECTIONS, isDirection } from "../content"
import { LabBar } from "../lab-bar"
import { ClayHome } from "../clay"
import { EstuaryHome } from "../estuary"
import { FolioHome } from "../folio"
import { TideHome } from "../tide"

export function generateStaticParams() {
  return DIRECTIONS.map((direction) => ({ direction: direction.id }))
}

export default async function BrandDirectionPage({
  params,
}: {
  params: Promise<{ direction: string }>
}) {
  const { direction } = await params
  if (!isDirection(direction)) notFound()
  return (
    <div className="bl" data-direction={direction}>
      <LabBar current={direction} view="home" />
      {direction === "tide" ? <TideHome /> : null}
      {direction === "clay" ? <ClayHome /> : null}
      {direction === "folio" ? <FolioHome /> : null}
      {direction === "estuary" ? <EstuaryHome /> : null}
    </div>
  )
}
