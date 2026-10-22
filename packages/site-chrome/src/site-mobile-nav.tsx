"use client"

import { ListIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { Logo } from "@eleva/ui/components/brand"
import { Sheet, SheetHeader, SheetTitle } from "@eleva/ui/components/sheet"
import * as React from "react"

/** Header menus collapsed into a side sheet below `lg`. */
export function SiteMobileNav({
  openLabel,
  title,
  children,
}: {
  openLabel: string
  title: string
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={openLabel}
        aria-expanded={isOpen}
        className="lg:hidden"
        onPress={() => setIsOpen(true)}
      >
        <ListIcon className="size-5" />
      </Button>
      <Sheet
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        side="right"
        className="w-full max-w-sm"
      >
        <SheetHeader className="pb-2">
          <SheetTitle>
            <Logo className="h-6" />
            <span className="sr-only">{title}</span>
          </SheetTitle>
        </SheetHeader>
        <div
          className="flex-1 overflow-y-auto px-3 pb-8"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) {
              setIsOpen(false)
            }
          }}
        >
          {children}
        </div>
      </Sheet>
    </>
  )
}
