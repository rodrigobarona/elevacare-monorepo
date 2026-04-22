'use client';

import { Link } from '@/lib/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center">
      <h1 className="mb-4 text-4xl font-bold">{t('title')}</h1>
      <p className="mb-8 text-lg text-muted-foreground">{t('description')}</p>
      <Link
        href="/"
        className="rounded-md bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90"
      >
        {t('goHome')}
      </Link>
    </div>
  );
}
