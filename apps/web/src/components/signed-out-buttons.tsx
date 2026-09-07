/**
 * Plain anchor links to /login and /signup — intentionally not using
 * the i18n `<Link>` so the browser does a full navigation and lets the
 * gateway proxy rewrite to the account zone. Internal SPA navigation
 * would bypass the cross-zone rewrite and hit a 404.
 *
 * `LinkButton` renders a native `<a>`; `apps/web` does not mount a React Aria
 * `RouterProvider`, so no client-side routing is attempted.
 */
import { LinkButton } from "@eleva/ui/components/button"

interface SignedOutButtonsProps {
  loginLabel: string
  getStartedLabel: string
}

export function SignedOutButtons({
  loginLabel,
  getStartedLabel,
}: SignedOutButtonsProps) {
  return (
    <>
      <LinkButton variant="ghost" size="sm" href="/login">
        {loginLabel}
      </LinkButton>
      <LinkButton size="sm" href="/signup">
        {getStartedLabel}
      </LinkButton>
    </>
  )
}
