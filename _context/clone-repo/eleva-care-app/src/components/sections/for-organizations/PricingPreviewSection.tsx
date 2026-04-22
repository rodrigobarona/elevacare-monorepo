import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import React from 'react';

interface PricingTier {
  name: string;
  price: string;
  description: string;
  features: string[];
  recommended?: boolean;
}

interface PricingPreviewSectionProps {
  title: string;
  subtitle?: string;
  note?: string;
  tiers: PricingTier[];
}

export default function PricingPreviewSection({
  title,
  subtitle,
  note,
  tiers,
}: PricingPreviewSectionProps) {
  return (
    <section className="bg-muted/30 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">{title}</h2>
            {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {tiers.map((tier, index) => (
              <Card
                key={index}
                className={`relative ${tier.recommended ? 'border-primary shadow-lg' : ''}`}
              >
                {tier.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-4 py-1 text-sm font-medium text-primary-foreground">
                      Recommended
                    </span>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{tier.price}</span>
                  </div>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          {note && <p className="mt-8 text-center text-sm text-muted-foreground">{note}</p>}
        </div>
      </div>
    </section>
  );
}
