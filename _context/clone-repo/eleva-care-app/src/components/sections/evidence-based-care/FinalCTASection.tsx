import { Button } from '@/components/ui/button';
import { ArrowRight, Mail } from 'lucide-react';
import Link from 'next/link';

interface FinalCTASectionProps {
  title: string;
  description: string;
  ctaPrimary: {
    text: string;
    href: string;
  };
  ctaSecondary: {
    text: string;
    href: string;
  };
  features: string;
}

export default function FinalCTASection({
  title,
  description,
  ctaPrimary,
  ctaSecondary,
  features,
}: FinalCTASectionProps) {
  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary to-purple-600 p-12 text-center text-white shadow-2xl">
          {/* Background decoration */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
            <p className="mb-8 text-lg text-white/90">{description}</p>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" variant="secondary" className="text-lg">
                <Link href={ctaPrimary.href}>
                  {ctaPrimary.text}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/10 text-lg text-white hover:bg-white/20"
              >
                <Link href={ctaSecondary.href}>
                  <Mail className="mr-2 h-5 w-5" />
                  {ctaSecondary.text}
                </Link>
              </Button>
            </div>

            <p className="mt-6 text-sm text-white/80">{features}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

