import { Button } from '@/components/ui/button';
import { Microscope } from 'lucide-react';
import Link from 'next/link';

interface HeroSectionProps {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  ctaPrimary: {
    text: string;
    href: string;
  };
  ctaSecondary: {
    text: string;
    href: string;
  };
}

export default function HeroSection({
  badge,
  title,
  subtitle,
  description,
  ctaPrimary,
  ctaSecondary,
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden py-24 md:py-32 lg:py-40">
      {/* Background gradient - Eleva brand colors */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]" />
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[500px] w-[500px] rounded-full bg-eleva-primary/20 blur-[100px]" />
        <div className="absolute bottom-0 right-0 -z-10 h-[400px] w-[400px] rounded-full bg-eleva-highlight-purple/15 blur-[100px]" />
        <div className="absolute left-20 top-1/2 -z-10 h-[300px] w-[300px] rounded-full bg-eleva-highlight-yellow/10 blur-[120px]" />
      </div>

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge - Eleva colors */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-eleva-primary/20 bg-linear-to-r from-eleva-primary/5 to-eleva-accent/50 px-4 py-2 text-sm font-medium text-eleva-primary backdrop-blur-xs">
            <Microscope className="h-4 w-4" />
            <span>{badge}</span>
          </div>

          {/* Title - Eleva brand gradient */}
          <h1 className="mb-8 text-balance font-serif text-5xl font-light leading-tight tracking-tight text-eleva-neutral-900 md:text-6xl lg:text-7xl">
            {title}
            <br />
            <span className="bg-linear-to-r from-eleva-primary via-eleva-secondary to-eleva-primary-light bg-clip-text text-transparent">
              {subtitle}
            </span>
          </h1>

          {/* Description - Better spacing */}
          <p className="mb-10 text-balance text-lg leading-relaxed text-eleva-neutral-900/70 md:text-xl">
            {description}
          </p>

          {/* CTA Buttons - Radiant style */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              asChild
              size="lg"
              className="rounded-full px-8 py-6 text-base font-semibold shadow-lg transition-all hover:scale-105"
            >
              <Link href={ctaPrimary.href}>{ctaPrimary.text}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-2 border-eleva-neutral-200 bg-white px-8 py-6 text-base font-semibold transition-all hover:scale-105 hover:border-primary/30"
            >
              <Link href={ctaSecondary.href}>{ctaSecondary.text}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

