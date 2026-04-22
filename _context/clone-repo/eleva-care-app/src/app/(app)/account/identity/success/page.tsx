import { redirect } from 'next/navigation';

/**
 * Legacy success page - identity verification now uses modal flow.
 * Redirect to main identity page which shows verified status.
 */
export default function IdentitySuccessPage() {
  redirect('/account/identity');
}
