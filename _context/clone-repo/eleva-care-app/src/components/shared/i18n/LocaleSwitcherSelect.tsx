'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils';
import { GlobeIcon, LoaderIcon } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTransition } from 'react';

interface LocaleOption {
  value: Locale;
  label: string;
}

interface Props {
  /** Currently selected locale */
  value: Locale;
  /** Available locale options */
  options: LocaleOption[];
  /** Accessible label for the select */
  label: string;
}

/**
 * Locale Switcher Select Component
 *
 * Accessible language selector using shadcn/ui Select (Radix UI).
 * Provides full keyboard navigation, ARIA attributes, and screen reader support.
 *
 * Features:
 * - Full keyboard navigation (Arrow keys, Enter, Escape, Home, End)
 * - ARIA attributes for screen readers
 * - Visual focus indicators
 * - Loading state during navigation
 * - Globe icon for visual context
 *
 * @see https://next-intl.dev/docs/routing/navigation#change-locale
 * @see https://ui.shadcn.com/docs/components/select
 *
 * @example
 * ```tsx
 * <LocaleSwitcherSelect
 *   value="en"
 *   options={[
 *     { value: 'en', label: 'English' },
 *     { value: 'pt', label: 'Português' },
 *   ]}
 *   label="Select language"
 * />
 * ```
 */
export default function LocaleSwitcherSelect({ value, options, label }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  function handleLocaleChange(nextLocale: string) {
    startTransition(() => {
      // When routing has `pathnames` configured, pass both pathname and params.
      // TypeScript can't verify at compile time that pathname and params match,
      // but at runtime they always will (they come from the same route).
      // This is the official next-intl approach for locale switching.
      // @ts-expect-error -- pathname and params always match at runtime
      router.replace({ pathname, params }, { locale: nextLocale as Locale });
    });
  }

  return (
    <Select value={value} onValueChange={handleLocaleChange} disabled={isPending}>
      <SelectTrigger
        className={cn(
          'h-8 w-auto gap-1.5 border-none bg-transparent px-2 shadow-none',
          'hover:bg-gray-100 focus:ring-0 focus:ring-offset-0',
          'focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2',
        )}
        aria-label={label}
      >
        {isPending ? (
          <LoaderIcon className="size-4 animate-spin text-gray-500" aria-hidden="true" />
        ) : (
          <GlobeIcon className="size-4 text-gray-500" aria-hidden="true" />
        )}
        <SelectValue placeholder={label}>
          {options.find((opt) => opt.value === value)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" position="popper" sideOffset={4}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
