import { ImageResponse } from "next/og"

const BRAND_COLOR = "rgb(0, 109, 119)"

export function renderBrandIcon(size: number) {
  const borderRadius = Math.round(size * 0.19)
  const fontSize = Math.round(size * 0.69)

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius,
        background: BRAND_COLOR,
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 700,
          color: "white",
          lineHeight: 1,
        }}
      >
        E
      </span>
    </div>,
    { width: size, height: size }
  )
}
