'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Availability', href: '/booking/schedule' },
  { name: 'Limits', href: '/booking/schedule/limits' },
];

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-regular font-serif text-3xl tracking-tight text-eleva-primary">
          Schedule Configuration
        </h1>
        <p className="mt-2 text-sm leading-6 text-eleva-neutral-900/70">
          Manage your availability schedule and booking preferences for client appointments.
        </p>
      </div>

      <div className="space-y-6">
        <nav className="border-b border-eleva-neutral-200">
          <div className="-mb-px flex space-x-0" aria-label="Tabs">
            {navigation.map((item) => (
              <Button
                key={item.name}
                variant="ghost"
                asChild
                className={`relative rounded-none border-b-2 px-4 py-3 text-sm font-medium transition-all duration-200 hover:border-eleva-neutral-900/25 hover:text-eleva-neutral-900 ${
                  item.href === pathname
                    ? 'border-eleva-primary text-eleva-primary hover:bg-transparent'
                    : 'border-transparent text-eleva-neutral-900/50 hover:bg-transparent'
                }`}
              >
                <Link href={item.href}>{item.name}</Link>
              </Button>
            ))}
          </div>
        </nav>

        <div>{children}</div>
      </div>
    </div>
  );
}
