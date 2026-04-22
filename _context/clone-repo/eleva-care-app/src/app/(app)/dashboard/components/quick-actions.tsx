'use client';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { Calendar, CreditCard, Search, Settings, User } from 'lucide-react';

interface QuickActionsProps {
  role: 'patient' | 'expert';
  isSetupComplete?: boolean;
}

const patientActions = [
  { label: 'Find an Expert', href: '/experts', icon: Search },
  { label: 'My Appointments', href: '/appointments', icon: Calendar },
  { label: 'Account', href: '/account', icon: User },
] as const;

const expertActions = [
  { label: 'Appointments', href: '/appointments', icon: Calendar },
  { label: 'Edit Profile', href: '/booking/expert', icon: User },
  { label: 'Billing', href: '/account/billing', icon: CreditCard },
  { label: 'Schedule', href: '/setup/availability', icon: Settings },
] as const;

const newExpertActions = [
  { label: 'Complete Setup', href: '/setup', icon: Settings },
  { label: 'Edit Profile', href: '/booking/expert', icon: User },
  { label: 'Schedule', href: '/setup/availability', icon: Calendar },
] as const;

export function QuickActions({ role, isSetupComplete }: QuickActionsProps) {
  const actions =
    role === 'patient'
      ? patientActions
      : isSetupComplete
        ? expertActions
        : newExpertActions;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button key={action.href} variant="outline" size="sm" asChild>
          <Link href={action.href as any}>
            <action.icon className="mr-1.5 h-3.5 w-3.5" />
            {action.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
