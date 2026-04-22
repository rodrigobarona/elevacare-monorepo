import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { CalendarCheck, DollarSign, Shield, TrendingUp, Users, Video } from 'lucide-react';

interface Benefit {
  icon: 'dollar' | 'calendar' | 'users' | 'video' | 'shield' | 'trending';
  title: string;
  description: string;
}

interface BenefitsSectionProps {
  title: string;
  benefits: Benefit[];
}

const iconMap: Record<Benefit['icon'], LucideIcon> = {
  dollar: DollarSign,
  calendar: CalendarCheck,
  users: Users,
  video: Video,
  shield: Shield,
  trending: TrendingUp,
};

export default function BenefitsSection({ title, benefits }: BenefitsSectionProps) {
  return (
    <section className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 text-center text-3xl font-bold">{title}</h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => {
            const Icon = iconMap[benefit.icon];
            return (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                    <Icon className="h-6 w-6 text-primary" />
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
