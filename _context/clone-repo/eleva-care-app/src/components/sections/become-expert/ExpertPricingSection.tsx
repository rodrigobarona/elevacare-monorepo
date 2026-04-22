'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Info } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

interface PlanDetails {
  name: string;
  price: string;
  priceDetail: string;
  commission: string;
  badge?: string;
  recommended?: boolean;
  savingsText?: string;
  description: string;
  features: string[];
  cta: {
    text: string;
    href: string;
  };
}

interface TierPricing {
  tierName: string;
  tierBadge?: string;
  tierIcon: React.ReactNode;
  tierColor: 'primary' | 'amber';
  description: string;
  plans: PlanDetails[];
  requirements?: string[];
}

interface ExpertPricingSectionProps {
  title: string;
  subtitle?: string;
  communityTier: TierPricing;
  topTier: TierPricing;
  note?: string;
}

export default function ExpertPricingSection({
  title,
  subtitle,
  communityTier,
  topTier,
  note,
}: ExpertPricingSectionProps) {
  return (
    <section className="bg-muted/30 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">{title}</h2>
            {subtitle && (
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {/* Community Expert Tier */}
          <div className="mb-16">
            <div className="mb-8 flex items-center gap-3">
              <div className={`text-2xl text-primary`}>{communityTier.tierIcon}</div>
              <div>
                <h3 className="text-2xl font-bold">{communityTier.tierName}</h3>
                <p className="text-muted-foreground">{communityTier.description}</p>
              </div>
            </div>

            {/* Community Expert Plans */}
            <div className="grid gap-6 md:grid-cols-3">
              {communityTier.plans.map((plan, index) => (
                <PlanCard
                  key={index}
                  plan={plan}
                  tierColor="primary"
                  isRecommended={plan.recommended}
                />
              ))}
            </div>
          </div>

          {/* Top Expert Tier */}
          <div className="mb-16">
            <div className="mb-8 flex items-center gap-3">
              <div className={`text-2xl text-amber-500`}>{topTier.tierIcon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold">{topTier.tierName}</h3>
                  {topTier.tierBadge && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-500">
                      {topTier.tierBadge}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{topTier.description}</p>
              </div>
            </div>

            {/* Top Expert Requirements */}
            {topTier.requirements && topTier.requirements.length > 0 && (
              <Card className="mb-6 border-amber-500/20 bg-amber-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Info className="h-5 w-5 text-amber-500" />
                    How to Qualify for Top Expert
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {topTier.requirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Top Expert Plans */}
            <div className="grid gap-6 md:grid-cols-3">
              {topTier.plans.map((plan, index) => (
                <PlanCard
                  key={index}
                  plan={plan}
                  tierColor="amber"
                  isRecommended={plan.recommended}
                />
              ))}
            </div>
          </div>

          {/* Note */}
          {note && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-center text-sm text-muted-foreground">{note}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  tierColor,
  isRecommended,
}: {
  plan: PlanDetails;
  tierColor: 'primary' | 'amber';
  isRecommended?: boolean;
}) {
  const colorClasses = {
    primary: {
      check: 'text-primary',
      badge: 'bg-primary text-white',
      savingsBg: 'bg-primary',
      border: isRecommended ? 'border-primary shadow-lg ring-2 ring-primary/20' : '',
    },
    amber: {
      check: 'text-amber-500',
      badge: 'bg-amber-500 text-white',
      savingsBg: 'bg-amber-500',
      border: isRecommended ? 'border-amber-500 shadow-lg ring-2 ring-amber-500/20' : '',
    },
  };

  const colors = colorClasses[tierColor];

  return (
    <Card
      className={`relative flex flex-col transition-all duration-300 ${colors.border || 'hover:border-muted-foreground/50'}`}
    >
      {isRecommended && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Badge className={`px-4 py-1 text-sm font-medium ${colors.badge}`}>⭐ Recommended</Badge>
        </div>
      )}

      {plan.badge && !isRecommended && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Badge variant="secondary" className="px-4 py-1 text-sm font-medium">
            {plan.badge}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-6">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription className="min-h-10 text-sm">{plan.description}</CardDescription>

        {/* Pricing */}
        <div className="mt-4 space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
            <span className="text-muted-foreground">{plan.priceDetail}</span>
          </div>

          {/* Savings Badge */}
          {plan.savingsText && (
            <div
              className={`inline-flex items-center gap-2 rounded-full ${colors.savingsBg} px-4 py-1.5 text-sm font-semibold text-white`}
            >
              {plan.savingsText}
            </div>
          )}

          {/* Commission Rate */}
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Commission per booking:</span>
              <span
                className={`text-xl font-bold ${tierColor === 'amber' ? 'text-amber-500' : 'text-primary'}`}
              >
                {plan.commission}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-6">
        {/* Features */}
        <div className="flex-1">
          <h4 className="mb-3 font-semibold">What&apos;s included:</h4>
          <ul className="space-y-3">
            {plan.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Check className={`mt-0.5 h-5 w-5 shrink-0 ${colors.check}`} />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA Button */}
        <Button
          asChild
          className="w-full"
          variant={isRecommended ? 'default' : 'outline'}
          size="lg"
        >
          <Link href={plan.cta.href}>{plan.cta.text}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
