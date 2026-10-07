"use client"

import { DotsThreeIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"
import { useRouter } from "@/i18n/navigation"

interface MobileNavMenuProps {
  label: string
  items: Array<{ href: string; label: string }>
}

/** Header links, collapsed into one menu below `md`. */
export function MobileNavMenu({ label, items }: MobileNavMenuProps) {
  const router = useRouter()

  return (
    <DropdownMenuTrigger>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        className="md:hidden"
      >
        <DotsThreeIcon className="size-5" />
      </Button>
      <DropdownMenu placement="bottom end">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.href}
            id={item.href}
            textValue={item.label}
            onAction={() => router.push(item.href)}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenu>
    </DropdownMenuTrigger>
  )
}
