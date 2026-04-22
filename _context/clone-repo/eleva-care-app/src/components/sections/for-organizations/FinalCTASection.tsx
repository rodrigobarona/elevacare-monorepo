import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

interface FinalCTASectionProps {
  title: string;
  description: string;
  cta: {
    text: string;
    href: string;
    icon: React.ReactNode;
  };
  support: {
    text: string;
    linkText: string;
    linkHref: string;
  };
}

export default function FinalCTASection({
  title,
  description,
  cta,
  support,
}: FinalCTASectionProps) {
  return (
    <section className="bg-linear-to-r from-primary/10 via-purple-500/10 to-primary/10 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          {/* Icon */}
          <div className="mb-6 inline-flex rounded-full bg-primary/20 p-4">
            <Rocket className="h-16 w-16 text-primary" />
          </div>

          {/* Title */}
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">{title}</h2>

          {/* Description */}
          <p className="mb-8 text-lg text-muted-foreground">{description}</p>

          {/* CTA Button */}
          <Button asChild size="lg" className="text-lg">
            <Link href={cta.href}>
              {cta.text} {cta.icon}
            </Link>
          </Button>

          {/* Support Text */}
          <p className="mt-6 text-sm text-muted-foreground">
            {support.text}{' '}
            <Link href={support.linkHref} className="text-primary hover:underline">
              {support.linkText}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
