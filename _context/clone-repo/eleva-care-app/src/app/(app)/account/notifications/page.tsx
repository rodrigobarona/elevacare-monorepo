import { SecurityPreferencesForm } from '@/components/features/profile/SecurityPreferencesForm';
import { withAuth } from '@workos-inc/authkit-nextjs';

// Note: Route is dynamic by default with cacheComponents enabled in Next.js 16

export default async function NotificationsPage() {
  await withAuth({ ensureSignedIn: true });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">My Notifications</h1>
          <p className="text-muted-foreground">
            Manage your personal notification settings for security alerts, appointments, and system
            updates.
          </p>
        </div>

        {/* Security Preferences Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Security & Privacy</h2>
            <p className="text-sm text-muted-foreground">
              Control when you receive security notifications and alerts about your account
              activity.
            </p>
          </div>
          <SecurityPreferencesForm />
        </div>

        {/* Future sections can be added here */}
        {/* 
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Appointments & Bookings</h2>
            <p className="text-sm text-muted-foreground">
              Manage notifications for appointment confirmations, reminders, and updates.
            </p>
          </div>
          <AppointmentNotificationsForm />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-medium">System Updates</h2>
            <p className="text-sm text-muted-foreground">
              Stay informed about platform updates, maintenance, and new features.
            </p>
          </div>
          <SystemNotificationsForm />
        </div>
        */}
      </div>
    </div>
  );
}
