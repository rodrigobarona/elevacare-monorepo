import { Card, CardContent } from '@/components/ui/card';
import {
  Building2,
  ChartColumnIncreasing,
  DollarSign,
  Headphones,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React from 'react';

type IconName =
  | 'building'
  | 'users'
  | 'dollar'
  | 'zap'
  | 'trending'
  | 'shield'
  | 'chart'
  | 'headphones';

const iconMap: Record<IconName, React.ElementType> = {
  building: Building2,
  users: Users,
  dollar: DollarSign,
  zap: Zap,
  trending: TrendingUp,
  shield: Shield,
  chart: ChartColumnIncreasing,
  headphones: Headphones,
};

interface Benefit {
  icon: IconName;
  title: string;
  description: string;
}

interface BenefitsSectionProps {
  title: string;
  benefits: Benefit[];
}

export default function BenefitsSection({ title, benefits }: BenefitsSectionProps) {
  return (
    <section className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 text-center text-3xl font-bold">{title}</h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => {
            const IconComponent = iconMap[benefit.icon];
            return (
              <Card key={index} className="transition-shadow hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
