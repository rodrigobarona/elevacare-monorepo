import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';

interface Step {
  title: string;
  description: string;
}

interface HowItWorksSectionProps {
  title: string;
  subtitle?: string;
  steps: Step[];
  cta: {
    text: string;
    href: string;
    icon: React.ReactNode;
  };
}

export default function HowItWorksSection({ title, subtitle, steps, cta }: HowItWorksSectionProps) {
  return (
    <section className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">{title}</h2>
          {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="space-y-8">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-6">
              {/* Step Number */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                {index + 1}
              </div>

              {/* Step Content */}
              <div className="flex-1">
                <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Button asChild size="lg" className="text-lg">
            <Link href={cta.href}>
              {cta.text} {cta.icon}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
