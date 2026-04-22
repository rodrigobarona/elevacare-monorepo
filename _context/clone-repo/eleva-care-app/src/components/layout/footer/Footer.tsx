import { LanguageSwitcher } from '@/components/shared/i18n/LocaleSwitcher';
import { CookiePreferencesButton } from '@/components/shared/ui-utilities/CookiePreferencesButton';
import { SentryFeedbackButton } from '@/components/shared/ui-utilities/SentryFeedbackButton';
import { ServerStatus } from '@/components/shared/ui-utilities/ServerStatus';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { useTranslations } from 'next-intl';
import NextLink from 'next/link';

import { FooterContentWrapper } from './FooterContentWrapper';

export default function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="w-full">
      <div className="lg:rounded-5xl mx-2 rounded-2xl bg-linear-145 from-eleva-highlight-yellow from-28% via-eleva-highlight-red via-70% to-eleva-highlight-purple">
        <div className="lg:rounded-5xl relative rounded-2xl">
          {/* Frosted glass effect overlay */}
          <div className="lg:rounded-5xl absolute inset-0 rounded-2xl bg-white/80" />

          <FooterContentWrapper placeholderHeight="h-96">
            <div className="relative px-6 lg:px-8">
              <div className="mx-auto max-w-2xl lg:max-w-7xl">
                {/* CTA Section */}
                <section className="relative my-32">
                  <div className="relative pb-16 pt-20 text-center sm:py-24">
                    <h2 className="mx-auto max-w-xs font-mono text-xs/5 font-normal uppercase tracking-widest text-eleva-neutral-900/70">
                      {t('cta.title')}
                    </h2>
                    <p className="mx-auto mt-2 max-w-3xl text-pretty font-serif text-4xl font-light tracking-tighter text-eleva-neutral-900 sm:text-6xl">
                      {t('cta.heading')}
                    </p>
                    <p className="mx-auto mt-6 max-w-xs text-sm/6 text-gray-500">
                      {t('cta.description')}
                    </p>
                    <div className="mt-6 flex justify-center gap-4">
                      <Button size="lg" className="rounded-full">
                        <NextLink href="https://patimota.typeform.com/to/XNQHJbgT" target="_blank">
                          {t('cta.quiz')}
                        </NextLink>
                      </Button>
                      <Button size="lg" variant="outline" className="rounded-full">
                        <NextLink href="/#experts">{t('cta.book')}</NextLink>
                      </Button>
                    </div>
                  </div>
                </section>

                {/* Navigation Links */}
                <div className="pb-16">
                  <div className="group/row relative isolate pt-[calc(--spacing(2)+1px)] last:pb-[calc(--spacing(2)+1px)]">
                    <div className="grid grid-cols-2 gap-y-10 pb-6 lg:grid-cols-6 lg:gap-8">
                      {/* Logo Column */}
                      <div className="col-span-2 flex">
                        <div className="pt-6 lg:pb-6">
                          <Link
                            href="/"
                            className="font-serif text-xl font-medium text-eleva-primary"
                          >
                            Eleva Care
                          </Link>
                          <p className="mt-4 text-sm text-eleva-neutral-900/60">{t('tagline')}</p>

                          {/* Compliance Badges - Cal.com style */}
                          <div className="mt-6 flex flex-wrap items-center gap-3">
                            {(['gdpr', 'lgpd', 'hipaa', 'iso27001'] as const).map((key) => (
                              <Link
                                key={key}
                                href="/trust/security"
                                className="flex h-12 items-center rounded-lg border border-gray-200/60 bg-white/80 px-3 transition-all hover:border-gray-300 hover:shadow-xs"
                                aria-label={
                                  key === 'gdpr'
                                    ? t('compliance.gdpr')
                                    : key === 'lgpd'
                                      ? t('compliance.lgpd')
                                      : key === 'hipaa'
                                        ? t('compliance.hipaa')
                                        : t('compliance.iso27001')
                                }
                              >
                                <span className="text-xs font-semibold text-gray-700">
                                  {key === 'gdpr'
                                    ? t('compliance.gdpr')
                                    : key === 'lgpd'
                                      ? t('compliance.lgpd')
                                      : key === 'hipaa'
                                        ? t('compliance.hipaa')
                                        : t('compliance.iso27001')}
                                </span>
                              </Link>
                            ))}
                          </div>

                          {/* Platform Disclaimer - Compact */}
                          <div className="mt-6 max-w-md rounded-lg border border-gray-200/40 bg-white/60 p-3">
                            <p className="text-xs font-semibold text-gray-700">
                              💙 {t('platformDisclaimer.title')}
                            </p>
                            <p className="mt-1 text-xs text-gray-600">
                              {t('platformDisclaimer.description')}
                            </p>
                          </div>

                          {/* Status Page Indicator - Cal.com style */}
                          <div className="mt-6 flex items-center gap-3">
                            <ServerStatus />
                          </div>
                        </div>
                      </div>

                      {/* Navigation Columns */}
                      <div className="col-span-2 grid grid-cols-2 gap-x-8 gap-y-12 lg:col-span-4 lg:grid-cols-4 lg:pt-6">
                        <div>
                          <h3 className="text-sm/6 font-medium text-eleva-neutral-900/50">
                            {t('nav.services.title')}
                          </h3>
                          <ul className="mt-6 space-y-4 text-sm/6">
                            <li>
                              <Link
                                href="/services/pregnancy"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.services.pregnancy')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/services/postpartum"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.services.postpartum')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/services/menopause"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.services.menopause')}
                              </Link>
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h3 className="text-sm/6 font-medium text-eleva-neutral-900/50">
                            {t('nav.company.title')}
                          </h3>
                          <ul className="mt-6 space-y-4 text-sm/6">
                            <li>
                              <Link
                                href="/about"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.company.about')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/evidence-based-care"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.company.clinicalExcellence')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/become-expert"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.company.becomeExpert')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/for-organizations"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.company.becomePartner')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/register"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.company.join')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/login"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.company.dashboard')}
                              </Link>
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h3 className="text-sm/6 font-medium text-eleva-neutral-900/50">
                            {t('nav.support.title')}
                          </h3>
                          <ul className="mt-6 space-y-4 text-sm/6">
                            <li>
                              <Link
                                href="/help"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.support.help')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/community"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.support.community')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/contact"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.support.contact')}
                              </Link>
                            </li>
                            <li>
                              <SentryFeedbackButton label={t('nav.support.reportBug')} />
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h3 className="text-sm/6 font-medium text-eleva-neutral-900/50">
                            {t('nav.trust.title')}
                          </h3>
                          <ul className="mt-6 space-y-4 text-sm/6">
                            <li>
                              <Link
                                href="/trust/security"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.trust.security')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/trust/dpa"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.trust.dpa')}
                              </Link>
                            </li>
                          </ul>

                          <h3 className="mt-8 text-sm/6 font-medium text-eleva-neutral-900/50">
                            {t('nav.legal.title')}
                          </h3>
                          <ul className="mt-6 space-y-4 text-sm/6">
                            <li>
                              <Link
                                href="/legal/terms"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.legal.terms')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/legal/privacy"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.legal.privacy')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/legal/cookie"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.legal.cookie')}
                              </Link>
                            </li>
                            <li>
                              <CookiePreferencesButton label={t('nav.legal.preferences')} />
                            </li>
                            <li>
                              <Link
                                href="/legal/payment-policies"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.legal.paymentPolicies')}
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/legal/expert-agreement"
                                className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
                              >
                                {t('nav.legal.expertAgreement')}
                              </Link>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Trust Indicators */}
                  <div className="border-t border-gray-200/20 pb-6 pt-8">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <svg
                          className="h-4 w-4 shrink-0 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="font-medium">{t('compliance.encryption')}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <svg
                          className="h-4 w-4 shrink-0 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                        </svg>
                        <span className="font-medium">{t('compliance.euData')}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <svg
                          className="h-4 w-4 shrink-0 text-green-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                        <span className="font-medium">{t('compliance.secureEmail')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Bar */}
                  <div className="flex justify-between border-t border-gray-200/20 pt-8">
                    <div>
                      <p className="text-sm/6 text-gray-600">
                        © {new Date().getFullYear()} Eleva Care. {t('copyright')}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Búzios e Tartarugas, Lda. · NIF PT515001708 · Portugal
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Language Switcher */}
                      <div className="text-gray-950">
                        <LanguageSwitcher />
                      </div>

                      {/* Social Links */}
                      <a
                        href="https://instagram.com/eleva.care"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-950 hover:text-gray-950/75"
                        aria-label={t('social.instagram')}
                      >
                        <span className="sr-only">{t('social.instagram')}</span>
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <title>Instagram</title>
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                        </svg>
                      </a>

                      <a
                        href="https://linkedin.com/company/eleva-care"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-950 hover:text-gray-950/75"
                        aria-label={t('social.linkedin')}
                      >
                        <span className="sr-only">{t('social.linkedin')}</span>
                        <svg
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <title>LinkedIn</title>
                          <path d="M14.82 0H1.18A1.169 1.169 0 000 1.154v13.694A1.168 1.168 0 001.18 16h13.64A1.17 1.17 0 0016 14.845V1.15A1.171 1.171 0 0014.82 0zM4.744 13.64H2.369V5.996h2.375v7.644zm-1.18-8.684a1.377 1.377 0 11.52-.106 1.377 1.377 0 01-.527.103l.007.003zm10.075 8.683h-2.375V9.921c0-.885-.015-2.025-1.234-2.025-1.218 0-1.425.966-1.425 1.968v3.775H6.233V5.997H8.51v1.05h.032c.317-.601 1.09-1.235 2.246-1.235 2.405-.005 2.851 1.578 2.851 3.63v4.197z" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FooterContentWrapper>
        </div>
      </div>
    </footer>
  );
}
