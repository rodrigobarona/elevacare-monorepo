/**
 * Unauthorized Page
 *
 * Shown when a user tries to access a protected resource
 * they don't have permission to view.
 */
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <ShieldAlert className="h-20 w-20 text-destructive" />
        </div>

        <h1 className="mb-4 text-4xl font-bold">Unauthorized</h1>

        <p className="mb-8 text-muted-foreground">
          You don&apos;t have permission to access this resource. Please contact an administrator if
          you believe this is an error.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
