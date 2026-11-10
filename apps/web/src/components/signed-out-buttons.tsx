/**
 * "Log in" is a plain anchor to /login — intentionally not the i18n
 * `<Link>` so the browser does a full navigation and lets the gateway
 * proxy rewrite to the account zone. Internal SPA navigation would bypass
 * the cross-zone rewrite and hit a 404. The main action is "Find an
 * expert": most visitors come for care, and booking needs no account.
 *
 * `LinkButton` renders a native `<a>`; `apps/web` does not mount a React Aria
 * `RouterProvider`, so no client-side routing is attempted.
 */
import { MagnifyingGlassIcon, UserIcon } from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"

interface SignedOutButtonsProps {
  loginLabel: string
  findExpertLabel: string
  /** Localised directory path, e.g. `/pt/experts`. */
  findExpertHref: string
}

export function SignedOutButtons({
  loginLabel,
  findExpertLabel,
  findExpertHref,
}: SignedOutButtonsProps) {
  return (
    <>
      <LinkButton
        variant="ghost"
        size="sm"
        href="/login"
        className="px-2 sm:px-3"
      >
        <UserIcon aria-hidden className="size-5 sm:hidden" />
        <span className="sr-only sm:not-sr-only">{loginLabel}</span>
      </LinkButton>
      {/* Phones show the icon only (the label stays for screen readers),
          so the menu button never leaves the screen. */}
      <LinkButton size="sm" href={findExpertHref} className="px-2.5 sm:px-3">
        <MagnifyingGlassIcon aria-hidden className="size-5 sm:hidden" />
        <span className="sr-only sm:not-sr-only">{findExpertLabel}</span>
      </LinkButton>
    </>
  )
}
