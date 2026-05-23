"use client"

import * as React from "react"
import L from "leaflet"
import { MapContainer, TileLayer, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { DEFAULT_BASEMAP, type CartoBasemapConfig } from "@/lib/map-basemaps"

/** Leaflet default marker paths break under bundlers — not used for pin UX but keeps imports safe */
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  })
}

function MapResizeObserver() {
  const map = useMap()
  React.useEffect(() => {
    const container = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(container)
    return () => ro.disconnect()
  }, [map])
  return null
}

function MapCenterSync({
  lat,
  lng,
  zoom,
  animate = false,
}: {
  lat: number
  lng: number
  zoom: number
  animate?: boolean
}) {
  const map = useMap()
  React.useEffect(() => {
    if (animate) {
      map.flyTo([lat, lng], zoom, { duration: 1.2 })
    } else {
      map.setView([lat, lng], zoom, { animate: false })
    }
  }, [lat, lng, zoom, animate, map])
  return null
}

export interface CartoMapProps {
  lat: number
  lng: number
  zoom: number
  className?: string
  interactive?: boolean
  scrollWheelZoom?: boolean
  basemap?: CartoBasemapConfig
  onMoveEnd?: (lat: number, lng: number) => void
  syncCenter?: boolean
  animateCenter?: boolean
  children?: React.ReactNode
}

export function CartoMap({
  lat,
  lng,
  zoom,
  className,
  interactive = true,
  scrollWheelZoom = true,
  basemap = DEFAULT_BASEMAP,
  onMoveEnd,
  syncCenter = false,
  animateCenter = false,
  children,
}: CartoMapProps) {
  return (
    <div className={className}>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        zoomControl={interactive}
        className="size-full rounded-[inherit]"
        style={{ minHeight: "100%" }}
      >
        <TileLayer
          url={basemap.url}
          attribution={basemap.attribution}
          subdomains={basemap.subdomains}
          maxZoom={basemap.maxZoom}
        />
        <MapResizeObserver />
        {syncCenter ? (
          <MapCenterSync
            lat={lat}
            lng={lng}
            zoom={zoom}
            animate={animateCenter}
          />
        ) : null}
        {onMoveEnd ? <MapMoveEndHandler onMoveEnd={onMoveEnd} /> : null}
        {children}
      </MapContainer>
    </div>
  )
}

function MapMoveEndHandler({
  onMoveEnd,
}: {
  onMoveEnd: (lat: number, lng: number) => void
}) {
  const map = useMap()
  React.useEffect(() => {
    const handler = () => {
      const center = map.getCenter()
      onMoveEnd(center.lat, center.lng)
    }
    map.on("moveend", handler)
    return () => {
      map.off("moveend", handler)
    }
  }, [map, onMoveEnd])
  return null
}
