import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';

interface HeroSectionProps {
  badge: {
    text: string;
    icon: React.ReactNode;
  };
  title: string;
  subtitle: string;
  description: string;
  cta: {
    text: string;
    href: string;
    icon: React.ReactNode;
  };
  secondaryCta: {
    text: string;
    href: string;
  };
  features: string;
}

export default function HeroSection({
  badge,
  title,
  subtitle,
  description,
  cta,
  secondaryCta,
  features,
}: HeroSectionProps) {
  return (
    <section className="container relative mx-auto px-4 py-20 md:py-32">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="mb-6 inline-block rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          {badge.icon}
          {badge.text}
        </div>

        {/* Title */}
        <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          {title}
          <br />
          <span className="bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            {subtitle}
          </span>
        </h1>

        {/* Description */}
        <p className="mb-8 text-lg text-muted-foreground md:text-xl">{description}</p>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="text-lg">
            <Link href={cta.href}>
              {cta.text} {cta.icon}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg">
            <Link href={secondaryCta.href}>{secondaryCta.text}</Link>
          </Button>
        </div>

        {/* Features */}
        <p className="mt-6 text-sm text-muted-foreground">{features}</p>
      </div>
    </section>
  );
}
