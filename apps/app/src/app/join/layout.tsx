import { Logo } from "@eleva/ui/components/brand"
import { publicHomeUrl } from "@/lib/public-home-url"

export const dynamic = "force-dynamic"

/**
 * People reach this page from an email or calendar invite, often without
 * an account, so it carries the Eleva logo and nothing else to navigate.
 */
export default function PublicJoinLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <header className="mx-auto max-w-4xl px-4 pt-6">
        <a
          href={publicHomeUrl()}
          // The page address carries the join grant: never pass it on.
          referrerPolicy="no-referrer"
          className="inline-flex rounded-md"
        >
          <Logo className="h-6" />
        </a>
      </header>
      <main>{children}</main>
    </>
  )
}
