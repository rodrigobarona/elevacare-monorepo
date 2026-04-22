import { isUserExpert } from '@/lib/integrations/workos/roles';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Expert Setup - Eleva Care',
  description: 'Complete your expert profile setup',
};

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  // Require authentication with WorkOS
  const { user } = await withAuth({ ensureSignedIn: true });

  // Check if user has an expert role
  const hasExpertRole = await isUserExpert(user.id);

  // Only allow experts to access this page
  if (!hasExpertRole) {
    return redirect('/unauthorized');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">{children}</main>
    </div>
  );
}
