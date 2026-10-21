"use client"

import type { ReactNode } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@eleva/ui/components/accordion"
import {
  Tabs as TabsRoot,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@eleva/ui/components/tabs"

/** `<Tabs items={["A", "B"]}>` with one `<Tab value="A">` per item. */
export function Tabs({
  items,
  children,
}: {
  items: readonly string[]
  children: ReactNode
}) {
  return (
    <TabsRoot className="my-6" defaultSelectedKey={items[0]}>
      <TabsList className="max-w-full flex-wrap overflow-x-auto">
        {items.map((item) => (
          <TabsTrigger key={item} id={item}>
            {item}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </TabsRoot>
  )
}

export function Tab({
  value,
  children,
}: {
  value: string
  children: ReactNode
}) {
  return (
    <TabsContent
      id={value}
      className="rounded-2xl border p-5 text-base [&>p:not(:last-child)]:mb-3"
    >
      {children}
    </TabsContent>
  )
}

/** `<Accordions type="single|multiple">` wrapping `<Accordion title>` items. */
export function Accordions({
  type = "single",
  children,
}: {
  type?: "single" | "multiple"
  children: ReactNode
}) {
  return (
    <Accordion className="my-6" allowsMultipleExpanded={type === "multiple"}>
      {children}
    </Accordion>
  )
}

export function AccordionEntry({
  title,
  id,
  children,
}: {
  title: string
  id?: string
  children: ReactNode
}) {
  return (
    <AccordionItem id={id ?? title}>
      <AccordionTrigger className="text-base">{title}</AccordionTrigger>
      <AccordionContent className="text-base text-muted-foreground">
        {children}
      </AccordionContent>
    </AccordionItem>
  )
}
