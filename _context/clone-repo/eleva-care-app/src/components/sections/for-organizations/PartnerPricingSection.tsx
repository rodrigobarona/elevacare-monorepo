import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Star } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

interface PricingTier {
  name: string;
  price: string;
  priceDetail?: string;
  description: string;
  features: string[];
  recommended?: boolean;
  cta: {
    text: string;
    href: string;
  };
}

interface PartnerPricingSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  tiers: PricingTier[];
  note?: string;
}

export default function PartnerPricingSection({
  title,
  subtitle,
  description,
  tiers,
  note,
}: PartnerPricingSectionProps) {
  return (
    <section className="bg-muted/30 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">{title}</h2>
            {subtitle && <p className="mb-2 text-lg text-muted-foreground">{subtitle}</p>}
            {description && (
              <p className="mx-auto max-w-3xl text-sm text-muted-foreground">{description}</p>
            )}
          </div>

          {/* Pricing Grid */}
          <div className="grid gap-8 md:grid-cols-3">
            {tiers.map((tier, index) => (
              <Card
                key={index}
                className={`relative flex flex-col ${tier.recommended ? 'border-primary shadow-xl md:scale-105' : ''}`}
              >
                {tier.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="flex items-center gap-1 bg-primary px-4 py-1 text-sm font-medium">
                      <Star className="h-3 w-3" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-6">
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription className="min-h-12">{tier.description}</CardDescription>

                  <div className="mt-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold tracking-tight">{tier.price}</span>
                      {tier.priceDetail && (
                        <span className="text-lg text-muted-foreground">{tier.priceDetail}</span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col">
                  <ul className="mb-8 flex-1 space-y-3">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <span className="text-sm leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    className="w-full"
                    variant={tier.recommended ? 'default' : 'outline'}
                    size="lg"
                  >
                    <Link href={tier.cta.href}>{tier.cta.text}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Revenue Share Info */}
          <div className="mt-12 rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-center text-lg font-semibold">Revenue Share Model</h3>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="mb-2 text-3xl font-bold text-primary">8-15%</div>
                <div className="text-sm text-muted-foreground">
                  Platform commission on expert bookings
                </div>
              </div>
              <div className="text-center">
                <div className="mb-2 text-3xl font-bold text-primary">Your Choice</div>
                <div className="text-sm text-muted-foreground">
                  Set your own partner marketing fee
                </div>
              </div>
              <div className="text-center">
                <div className="mb-2 text-3xl font-bold text-primary">60%+</div>
                <div className="text-sm text-muted-foreground">
                  Experts always keep at least 60%
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          {note && <p className="mt-8 text-center text-sm text-muted-foreground">{note}</p>}
        </div>
      </div>
    </section>
  );
}
