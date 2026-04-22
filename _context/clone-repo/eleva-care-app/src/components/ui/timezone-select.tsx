'use client';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatTimezoneOffset } from '@/lib/utils/formatters';
import { Info } from 'lucide-react';
import type { Control, FieldValues, Path } from 'react-hook-form';

const CONTINENT_LABELS: Record<string, string> = {
  America: '🌎 Americas',
  Europe: '🌍 Europe',
  Asia: '🌏 Asia',
  Africa: '🌍 Africa',
  Pacific: '🌏 Pacific',
  Atlantic: '🌍 Atlantic',
  Indian: '🌏 Indian',
  Antarctica: '❄️ Antarctica',
  Australia: '🌏 Australia',
};

interface GroupedTimezone {
  continent: string;
  timezones: { value: string; label: string; offset: string }[];
}

const groupTimezones = () => {
  const timezones = Intl.supportedValuesOf('timeZone');
  const grouped: Record<string, { value: string; label: string; offset: string }[]> = {};

  for (const timezone of timezones) {
    const [continent = 'Other'] = timezone.split('/');
    if (!grouped[continent]) {
      grouped[continent] = [];
    }

    const parts = timezone.split('/');
    const city = parts[parts.length - 1]?.replace(/_/g, ' ') || timezone;
    const offset = formatTimezoneOffset(timezone);

    grouped[continent].push({
      value: timezone,
      label: city,
      offset: offset,
    });
  }

  return Object.entries(grouped)
    .map(
      ([continent, timezones]): GroupedTimezone => ({
        continent,
        timezones: timezones.sort((a, b) => {
          const offsetCompare = a.offset.localeCompare(b.offset);
          return offsetCompare !== 0 ? offsetCompare : a.label.localeCompare(b.label);
        }),
      }),
    )
    .sort((a, b) => a.continent.localeCompare(b.continent));
};

const getDisplayLabel = (continent: string): string => {
  return CONTINENT_LABELS[continent] ?? `🌍 ${continent}`;
};

interface TimezoneSelectProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  className?: string;
  showTooltip?: boolean;
  tooltipText?: string;
}

export function TimezoneSelect<T extends FieldValues>({
  name,
  control,
  className,
  showTooltip = true,
  tooltipText = 'Your timezone was automatically detected',
}: TimezoneSelectProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className={cn('flex items-center gap-2', className)}>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="w-[360px] border-eleva-neutral-200">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-[320px] overflow-hidden">
                {groupTimezones().map((group) => (
                  <div key={group.continent} className="relative">
                    <div className="sticky -top-1 z-10 border-b border-eleva-neutral-200 bg-white px-2 py-1">
                      <div className="font-serif text-sm font-medium tracking-tight text-eleva-primary">
                        {getDisplayLabel(group.continent)}
                      </div>
                    </div>
                    {group.timezones.map((timezone) => (
                      <SelectItem
                        key={timezone.value}
                        value={timezone.value}
                        className={cn(
                          'cursor-pointer pl-4 pr-2',
                          field.value === timezone.value && 'bg-eleva-primary/5',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm">{timezone.label}</span>
                          <span className="font-mono text-xs text-eleva-neutral-900/60">
                            {timezone.offset}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {showTooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-6">
                      <Info className="size-4 text-eleva-neutral-900/60" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-eleva-primary px-3 py-1.5 text-xs text-white">
                    {tooltipText}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <FormMessage className="text-xs text-eleva-highlight-red" />
        </FormItem>
      )}
    />
  );
}
