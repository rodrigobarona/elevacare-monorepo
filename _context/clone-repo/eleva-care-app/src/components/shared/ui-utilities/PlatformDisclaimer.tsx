'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AlertCircle, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

/**
 * PlatformDisclaimer Component
 *
 * Modal dialog displaying critical legal disclaimers about the platform nature and emergency services.
 * Required for legal compliance to clarify that Eleva Care is a digital health platform that does not provide clinical care.
 *
 * @example
 * ```tsx
 * <PlatformDisclaimer>
 *   <button>Learn more about our platform</button>
 * </PlatformDisclaimer>
 * ```
 */
export function PlatformDisclaimer({ children }: { children: React.ReactNode }) {
  const t = useTranslations('platformDisclaimer');
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-eleva-primary/20 sm:max-w-2xl">
        <DialogHeader className="space-y-3 pb-4">
          <DialogTitle className="font-serif text-2xl font-light tracking-tight text-eleva-primary">
            {t('modal.title')}
          </DialogTitle>
          <DialogDescription className="text-eleva-neutral-700 font-sans text-sm leading-relaxed">
            {t('modal.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Platform Nature - Primary Card */}
          <div className="rounded-xl border border-eleva-primary/20 bg-linear-to-br from-eleva-primary/5 to-eleva-primary/10 p-5 shadow-xs">
            <h3 className="mb-3 font-serif text-lg font-medium text-eleva-primary">
              {t('platform.title')}
            </h3>
            <p className="mb-4 font-sans text-sm leading-relaxed text-eleva-neutral-900">
              {t('platform.description')}
            </p>

            <div className="grid gap-5 md:grid-cols-2">
              {/* What We Provide */}
              <div className="rounded-lg bg-white/60 p-4 shadow-xs">
                <h4 className="mb-3 font-sans text-sm font-semibold text-eleva-primary">
                  {t('platform.weAre')}
                </h4>
                <ul className="text-eleva-neutral-700 space-y-2.5 font-sans text-xs leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-eleva-primary/20 text-[10px] font-bold text-eleva-primary"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span>{t('platform.weAreList.platform')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-eleva-primary/20 text-[10px] font-bold text-eleva-primary"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span>{t('platform.weAreList.technology')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-eleva-primary/20 text-[10px] font-bold text-eleva-primary"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span>{t('platform.weAreList.secure')}</span>
                  </li>
                </ul>
              </div>

              {/* What We Don't Provide */}
              <div className="rounded-lg bg-white/60 p-4 shadow-xs">
                <h4 className="text-eleva-neutral-700 mb-3 font-sans text-sm font-semibold">
                  {t('platform.weAreNot')}
                </h4>
                <ul className="text-eleva-neutral-700 space-y-2.5 font-sans text-xs leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span
                      className="text-eleva-neutral-600 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-eleva-neutral-200 text-[10px] font-bold"
                      aria-hidden="true"
                    >
                      ✗
                    </span>
                    <span>{t('platform.weAreNotList.provider')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span
                      className="text-eleva-neutral-600 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-eleva-neutral-200 text-[10px] font-bold"
                      aria-hidden="true"
                    >
                      ✗
                    </span>
                    <span>{t('platform.weAreNotList.employer')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span
                      className="text-eleva-neutral-600 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-eleva-neutral-200 text-[10px] font-bold"
                      aria-hidden="true"
                    >
                      ✗
                    </span>
                    <span>{t('platform.weAreNotList.responsible')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Emergency Information - Softer Design */}
          <div className="bg-eleva-neutral-50 rounded-xl border border-eleva-neutral-200 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-eleva-primary/10 p-2">
                <AlertCircle className="h-5 w-5 text-eleva-primary" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h3 className="mb-2 font-sans text-base font-semibold text-eleva-neutral-900">
                  {t('emergency.title')}
                </h3>
                <p className="text-eleva-neutral-700 mb-3 font-sans text-sm leading-relaxed">
                  {t('emergency.description')}
                </p>
                <div className="flex flex-wrap gap-3 font-mono text-sm font-medium text-eleva-primary">
                  <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-xs">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    <span>{t('emergency.eu')}: 112</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-xs">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    <span>{t('emergency.usa')}: 911</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with Terms Link */}
          <p className="text-eleva-neutral-600 border-t border-eleva-neutral-200 pt-4 text-center font-sans text-xs leading-relaxed">
            {t('platform.footer')}{' '}
            <Link
              href="/legal/terms"
              className="font-medium text-eleva-primary underline decoration-eleva-primary/30 underline-offset-2 transition-colors hover:text-eleva-primary/80 hover:decoration-eleva-primary focus:outline-hidden focus:ring-2 focus:ring-eleva-primary focus:ring-offset-2"
              onClick={() => setOpen(false)}
            >
              {t('platform.termsLink')}
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
