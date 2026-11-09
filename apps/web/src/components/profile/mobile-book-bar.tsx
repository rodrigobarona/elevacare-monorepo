"use client"

import { useEffect, useRef, useState } from "react"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { cn } from "@eleva/ui/lib/utils"

/**
 * Phone-only bottom bar ("From €45 · See times"). It is a plain anchor to
 * the booking card, so it works before hydration; once the card is on
 * screen the bar leaves the page and the tab order. While shown, the page
 * keeps focused content clear of it (WCAG 2.4.11).
 */
export function MobileBookBar({
  priceLabel,
  actionLabel,
  targetId,
}: {
  priceLabel: string | null
  actionLabel: string
  targetId: string
}) {
  const [isHidden, setIsHidden] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsHidden(Boolean(entry?.isIntersecting)),
      { threshold: 0.15 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [targetId])

  // Recomputed when the bar shows or hides, the viewport crosses the phone
  // breakpoint, or the bar changes height (text zoom, rotation).
  useEffect(() => {
    const root = document.documentElement
    const bar = barRef.current
    const phone = window.matchMedia("(max-width: 1023px)")
    const update = () => {
      root.style.scrollPaddingBottom =
        !isHidden && phone.matches && bar ? `${bar.offsetHeight + 16}px` : ""
    }
    update()
    phone.addEventListener("change", update)
    const resize = bar ? new ResizeObserver(update) : null
    if (bar) resize?.observe(bar)
    return () => {
      phone.removeEventListener("change", update)
      resize?.disconnect()
      root.style.scrollPaddingBottom = ""
    }
  }, [isHidden])

  return (
    <div
      ref={barRef}
      inert={isHidden}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-3 backdrop-blur lg:hidden",
        isHidden && "hidden"
      )}
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
        {priceLabel ? (
          <p className="text-base font-medium">{priceLabel}</p>
        ) : (
          <span />
        )}
        <a
          href={`#${targetId}`}
          onClick={() => {
            // Land keyboard and screen-reader focus on the card heading.
            requestAnimationFrame(() => {
              document
                .getElementById(targetId)
                ?.querySelector<HTMLElement>("h2[tabindex='-1']")
                ?.focus({ preventScroll: true })
            })
          }}
          className={buttonVariants({
            size: "lg",
            className: "min-h-11 rounded-full",
          })}
        >
          {actionLabel}
        </a>
      </div>
    </div>
  )
}
