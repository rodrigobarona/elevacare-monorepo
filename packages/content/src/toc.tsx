"use client"

import { AnchorProvider, TOCItem, type TOCItemType } from "fumadocs-core/toc"
import { cn } from "@eleva/ui/lib/utils"

/** Sticky "On this page" list with scroll-spy, built on Fumadocs headless TOC. */
export function TableOfContents({
  items,
  title,
  className,
}: {
  items: readonly TOCItemType[]
  title: string
  className?: string
}) {
  const visible = items.filter((item) => item.depth <= 3)
  if (visible.length === 0) {
    return null
  }
  return (
    <AnchorProvider toc={[...visible]} single>
      <nav aria-label={title} className={cn("text-sm", className)}>
        <p className="eyebrow text-muted-foreground">{title}</p>
        <ul className="mt-3 space-y-1 border-l">
          {visible.map((item) => (
            <li key={item.url}>
              <TOCItem
                href={item.url}
                className={cn(
                  "-ml-px block border-l border-transparent py-1 text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-primary data-[active=true]:text-foreground",
                  item.depth >= 3 ? "pl-6" : "pl-3"
                )}
              >
                {item.title}
              </TOCItem>
            </li>
          ))}
        </ul>
      </nav>
    </AnchorProvider>
  )
}
