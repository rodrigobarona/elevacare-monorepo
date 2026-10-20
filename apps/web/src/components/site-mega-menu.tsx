"use client"

import { CaretDownIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"
import * as React from "react"
import { usePathname } from "@/i18n/navigation"

export type SiteMegaMenuItem = {
  id: string
  label: string
  matches: readonly string[]
  panel: React.ReactNode
}

const OPEN_DELAY_MS = 120
const CLOSE_DELAY_MS = 180

function closeOnLinkClick(
  event: React.MouseEvent<HTMLElement>,
  close: () => void
) {
  if (event.target instanceof Element && event.target.closest("a")) close()
}

/**
 * Header disclosure menus (dub.co / resend.com style). Panels are server
 * rendered and span the sticky header, which is their containing block.
 */
export function SiteMegaMenu({
  items,
}: {
  items: readonly SiteMegaMenuItem[]
}) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const openedByHover = React.useRef(false)
  const timer = React.useRef<number | undefined>(undefined)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const baseId = React.useId()

  const clearTimer = React.useCallback(() => {
    window.clearTimeout(timer.current)
  }, [])

  const close = React.useCallback(() => {
    clearTimer()
    setOpenId(null)
  }, [clearTimer])

  const schedule = (next: string | null, delay: number) => {
    clearTimer()
    timer.current = window.setTimeout(() => {
      openedByHover.current = next !== null
      setOpenId(next)
    }, delay)
  }

  React.useEffect(() => clearTimer, [clearTimer])

  React.useEffect(() => {
    if (!openId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      close()
      document.getElementById(`${baseId}-${openId}-trigger`)?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [openId, baseId, close])

  const onHoverLeave = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse") schedule(null, CLOSE_DELAY_MS)
  }

  return (
    <div ref={rootRef} className="hidden items-center gap-1 lg:flex">
      {items.map((item) => {
        const isOpen = openId === item.id
        const isCurrent = item.matches.some(
          (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
        )
        const triggerId = `${baseId}-${item.id}-trigger`
        const panelId = `${baseId}-${item.id}-panel`

        return (
          <div key={item.id}>
            <button
              type="button"
              id={triggerId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              data-open={isOpen || undefined}
              data-current={isCurrent || undefined}
              onClick={() => {
                clearTimer()
                if (isOpen && openedByHover.current) {
                  openedByHover.current = false
                  return
                }
                openedByHover.current = false
                setOpenId(isOpen ? null : item.id)
              }}
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse") return
                schedule(item.id, openId ? 0 : OPEN_DELAY_MS)
              }}
              onPointerLeave={onHoverLeave}
              className="group inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-current:text-foreground data-open:bg-muted data-open:text-foreground"
            >
              {item.label}
              <CaretDownIcon
                aria-hidden
                className="size-3.5 transition-transform duration-200 group-data-open:rotate-180"
              />
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              inert={!isOpen}
              onPointerEnter={clearTimer}
              onPointerLeave={onHoverLeave}
              onClick={(event) => closeOnLinkClick(event, close)}
              className={cn(
                "absolute inset-x-0 top-full z-10 border-b border-border/60 bg-background shadow-2 transition-[opacity,translate,visibility] duration-200 ease-out",
                isOpen
                  ? "visible translate-y-0 opacity-100"
                  : "pointer-events-none invisible -translate-y-1 opacity-0"
              )}
            >
              {item.panel}
            </div>
          </div>
        )
      })}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-full h-dvh bg-foreground/10 transition-opacity duration-200",
          openId ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  )
}
