import { isContentLocale } from "@eleva/content/locales"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"

type Props = {
  children: ReactNode
  params: Promise<{ locale: string }>
}

export default async function DocsLocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!isContentLocale(locale)) {
    notFound()
  }
  return children
}
