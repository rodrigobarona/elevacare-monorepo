import { isUserExpert } from '@/lib/integrations/workos/roles';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

interface BookingLayoutProps {
  children: React.ReactNode;
}

export default async function BookingLayout({ children }: BookingLayoutProps) {
  // Require authentication with WorkOS
  const { user } = await withAuth({ ensureSignedIn: true });

  // Check if user is an expert using the centralized isExpert function
  const userIsExpert = await isUserExpert(user.id);

  if (!userIsExpert) {
    redirect('/unauthorized');
  }

  return <>{children}</>;
}
