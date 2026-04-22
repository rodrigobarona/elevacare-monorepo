import { SchedulingSettingsForm } from '@/components/features/forms/SchedulingSettingsForm';
import { withAuth } from '@workos-inc/authkit-nextjs';

// Note: Route is dynamic by default with cacheComponents enabled in Next.js 16

export default async function LimitsPage() {
  await withAuth({ ensureSignedIn: true });

  return <SchedulingSettingsForm />;
}
