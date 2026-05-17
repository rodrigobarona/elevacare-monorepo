import { Button } from "@eleva/ui/components/button"

interface SignedOutButtonsProps {
  loginLabel: string
  getStartedLabel: string
}

/**
 * Plain anchor links to /login and /signup -- intentionally not using
 * the i18n `<Link>` so the browser does a full navigation and lets the
 * gateway proxy rewrite to the account zone. Internal SPA navigation
 * would bypass the cross-zone rewrite and hit a 404.
 */
export function SignedOutButtons({
  loginLabel,
  getStartedLabel,
}: SignedOutButtonsProps) {
  return (
    <>
      <Button variant="ghost" size="sm" asChild>
        <a href="/login">{loginLabel}</a>
      </Button>
      <Button size="sm" asChild>
        <a href="/signup">{getStartedLabel}</a>
      </Button>
    </>
  )
}
