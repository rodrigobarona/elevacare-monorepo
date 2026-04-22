'use client';

import { SecurityPreferencesForm } from '@/components/features/profile/SecurityPreferencesForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Shield, Key, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Security & Privacy Page
 * Simplified version for WorkOS AuthKit
 * 
 * Note: Full Clerk-based security page backed up to page.tsx.clerk-backup
 * This version provides basic security settings until WorkOS session management is fully integrated.
 */
export default function SecurityPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
      router.push('/sign-in');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Security & Privacy</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Security & Privacy</h1>
          <p className="text-muted-foreground">
            Manage your account security, active sessions, and privacy settings.
          </p>
        </div>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>Your basic account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium">User ID</p>
              <p className="text-sm font-mono text-muted-foreground">{user.id}</p>
            </div>
            {user.firstName && (
              <div>
                <p className="text-sm font-medium">Name</p>
                <p className="text-sm text-muted-foreground">
                  {user.firstName} {user.lastName || ''}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium">Email Verified</p>
              <p className="text-sm text-muted-foreground">
                {user.emailVerified ? '✓ Verified' : '⚠ Not verified'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Password & Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Password & Authentication
            </CardTitle>
            <CardDescription>
              Manage your password and authentication methods via WorkOS
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-muted bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                Password and authentication settings are managed through your WorkOS account.
                Use the &quot;Manage Account&quot; button in your profile menu to access these settings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Manage your active sessions across devices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Current Session</p>
                  <p className="text-xs text-muted-foreground">This device • Active now</p>
                </div>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Privacy Settings</CardTitle>
            <CardDescription>Control your privacy and data preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <SecurityPreferencesForm />
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Irreversible account actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
              <p className="text-sm text-muted-foreground">
                Account deletion and other critical actions are managed through WorkOS.
                Contact support if you need to delete your account.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Migration Notice */}
        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> This page has been simplified during the migration to WorkOS AuthKit.
            Advanced session management features will be restored in a future update.
            The original Clerk-based security page is backed up for reference.
          </p>
        </div>
      </div>
    </div>
  );
}

