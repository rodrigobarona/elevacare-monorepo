'use client';

/**
 * ClinicalExpertsSection Component
 *
 * Placeholder component for clinical experts section on the About page.
 * TODO: Implement the full design with expert cards, specialties, etc.
 */

type ClinicalExpertsSectionProps = {
  title?: string;
  description?: string;
};

export default function ClinicalExpertsSection({
  title = 'Our Clinical Experts',
  description = 'Meet the healthcare professionals behind Eleva Care.',
}: ClinicalExpertsSectionProps) {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-4 font-mono text-xs/5 font-normal uppercase tracking-widest text-eleva-neutral-900/70">
          {title}
        </h2>
        <p className="mb-8 max-w-2xl text-lg text-muted-foreground">
          {description}
        </p>
        {/* TODO: Add clinical expert cards/grid here */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Expert cards will go here */}
        </div>
      </div>
    </section>
  );
}


