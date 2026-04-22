import { Card, CardContent } from '@/components/ui/card';
import { Award, Users, TrendingUp, Heart, FileText, Activity } from 'lucide-react';

interface StatItem {
  icon: 'award' | 'users' | 'trending' | 'heart' | 'file-text' | 'activity';
  value: string;
  label: string;
  description: string;
}

interface KeyNumbersSectionProps {
  title: string;
  subtitle: string;
  stats: StatItem[];
}

const iconMap = {
  award: Award,
  users: Users,
  trending: TrendingUp,
  heart: Heart,
  'file-text': FileText,
  activity: Activity,
};

export default function KeyNumbersSection({ title, subtitle, stats }: KeyNumbersSectionProps) {
  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        {/* Header - Radiant style */}
        <div className="mb-16 text-center">
          <h2 className="mb-6 font-serif text-4xl font-light tracking-tight text-eleva-neutral-900 md:text-5xl">
            {title}
          </h2>
          <p className="mx-auto max-w-2xl text-balance text-lg leading-relaxed text-eleva-neutral-900/70">
            {subtitle}
          </p>
        </div>

        {/* Stats Grid - Improved spacing and typography */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => {
            const Icon = iconMap[stat.icon];
            if (!Icon) {
              console.warn(`Icon "${stat.icon}" not found in iconMap`);
              return null;
            }
            return (
              <Card
                key={index}
                className="group border border-eleva-neutral-200 bg-white transition-all hover:border-eleva-primary/30 hover:shadow-md"
              >
                <CardContent className="p-8">
                  {/* Icon - Eleva colors */}
                  <div className="mb-6 inline-flex rounded-xl bg-linear-to-br from-eleva-primary/10 to-eleva-accent/50 p-3 transition-transform group-hover:scale-110">
                    <Icon className="h-6 w-6 text-eleva-primary" />
                  </div>

                  {/* Value - Serif font with Eleva primary */}
                  <div className="mb-3 font-serif text-5xl font-light tracking-tighter text-eleva-primary">
                    {stat.value}
                  </div>

                  {/* Label */}
                  <div className="mb-2 text-base font-semibold text-eleva-neutral-900">{stat.label}</div>

                  {/* Description */}
                  <p className="text-sm leading-relaxed text-eleva-neutral-900/60">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

