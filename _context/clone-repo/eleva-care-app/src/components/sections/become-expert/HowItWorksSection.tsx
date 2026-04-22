import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Step {
  title: string;
  description: string;
}

interface HowItWorksSectionProps {
  title: string;
  steps: Step[];
  ctaButton: string;
}

export default function HowItWorksSection({ title, steps, ctaButton }: HowItWorksSectionProps) {
  return (
    <section className="bg-muted/30 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold">{title}</h2>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <div>
                  <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button asChild size="lg" className="text-lg">
              <Link href="/register?expert=true">
                {ctaButton} <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
