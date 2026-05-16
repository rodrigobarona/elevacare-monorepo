import { renderBrandIcon } from "@eleva/ui/lib/brand-icon"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return renderBrandIcon(size.width)
}
