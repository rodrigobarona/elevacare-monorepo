import type { LucideIcon } from 'lucide-react';
import { BadgeCheck, Globe, Heart, MessageSquare } from 'lucide-react';

interface Requirement {
  icon: 'badge' | 'globe' | 'message' | 'heart';
  title: string;
  description: string;
}

interface RequirementsSectionProps {
  title: string;
  requirements: Requirement[];
}

const iconMap: Record<Requirement['icon'], LucideIcon> = {
  badge: BadgeCheck,
  globe: Globe,
  message: MessageSquare,
  heart: Heart,
};

export default function RequirementsSection({ title, requirements }: RequirementsSectionProps) {
  return (
    <section className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-8 text-center text-3xl font-bold">{title}</h2>

        <div className="grid gap-6 md:grid-cols-2">
          {requirements.map((requirement, index) => {
            const Icon = iconMap[requirement.icon];
            return (
              <div key={index} className="flex items-start gap-4">
                <Icon className="mt-1 h-6 w-6 text-primary" />
                <div>
                  <h3 className="mb-1 font-semibold">{requirement.title}</h3>
                  <p className="text-sm text-muted-foreground">{requirement.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
