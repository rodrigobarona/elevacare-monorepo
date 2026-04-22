import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, FileCheck, UserCheck } from 'lucide-react';

interface SafetyFeature {
  icon: 'shield' | 'lock' | 'file-check' | 'user-check';
  title: string;
  description: string;
}

interface SafetyQualitySectionProps {
  title: string;
  subtitle: string;
  features: SafetyFeature[];
}

const iconMap = {
  shield: Shield,
  lock: Lock,
  'file-check': FileCheck,
  'user-check': UserCheck,
};

export default function SafetyQualitySection({ title, subtitle, features }: SafetyQualitySectionProps) {
  return (
    <section className="bg-linear-to-b from-white to-eleva-neutral-50/50 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          {/* Header - Radiant style */}
          <div className="mb-16 text-center">
            <h2 className="mb-6 font-serif text-4xl font-light tracking-tight text-eleva-neutral-900 md:text-5xl">
              {title}
            </h2>
            <p className="mx-auto max-w-2xl text-balance text-lg leading-relaxed text-eleva-neutral-900/70">
              {subtitle}
            </p>
          </div>

          {/* Features Grid - Improved spacing */}
          <div className="grid gap-8 md:grid-cols-2">
            {features.map((feature, index) => {
              const Icon = iconMap[feature.icon];
              return (
                <Card
                  key={index}
                  className="group border border-eleva-neutral-200 bg-white transition-all hover:border-eleva-secondary/30 hover:shadow-md"
                >
                  <CardHeader className="pb-4">
                    <div className="mb-4 inline-flex rounded-xl bg-linear-to-br from-eleva-secondary/10 to-eleva-secondary-light/50 p-3 transition-transform group-hover:scale-110">
                      <Icon className="h-6 w-6 text-eleva-secondary" />
                    </div>
                    <CardTitle className="text-xl font-semibold tracking-tight text-eleva-neutral-900">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="leading-relaxed text-eleva-neutral-900/70">{feature.description}</p>
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

