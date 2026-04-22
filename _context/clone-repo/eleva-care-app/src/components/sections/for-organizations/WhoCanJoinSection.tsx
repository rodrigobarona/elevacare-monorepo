import { Card, CardContent } from '@/components/ui/card';
import { Activity, Apple, Brain, Dumbbell, HeartPulse, Sparkles, Stethoscope } from 'lucide-react';
import React from 'react';

type IconName =
  | 'stethoscope'
  | 'heartPulse'
  | 'apple'
  | 'brain'
  | 'dumbbell'
  | 'activity'
  | 'sparkles';

const iconMap: Record<IconName, React.ElementType> = {
  stethoscope: Stethoscope,
  heartPulse: HeartPulse,
  apple: Apple,
  brain: Brain,
  dumbbell: Dumbbell,
  activity: Activity,
  sparkles: Sparkles,
};

interface PartnerType {
  icon: IconName;
  title: string;
  examples: string[];
}

interface WhoCanJoinSectionProps {
  title: string;
  subtitle?: string;
  partnerTypes: PartnerType[];
}

export default function WhoCanJoinSection({
  title,
  subtitle,
  partnerTypes,
}: WhoCanJoinSectionProps) {
  return (
    <section className="bg-muted/30 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-3xl font-bold">{title}</h2>
          {subtitle && <p className="mb-12 text-lg text-muted-foreground">{subtitle}</p>}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {partnerTypes.map((type, index) => {
              const IconComponent = iconMap[type.icon];
              return (
                <Card key={index} className="text-left transition-shadow hover:shadow-lg">
                  <CardContent className="pt-6">
                    <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-3 text-lg font-semibold">{type.title}</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {type.examples.map((example, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="mr-2 text-primary">•</span>
                          {example}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
