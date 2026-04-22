import { redirect } from 'next/navigation';

/**
 * Legacy callback page - identity verification now uses modal flow (no redirect).
 * Redirect to main identity page.
 */
export default function IdentityCallbackPage() {
  redirect('/account/identity');
}
