'use client';

type HeadlineSectionProps = {
  label?: string;
  title: string;
  headingLevel?: 'h1' | 'h2';
  description: string;
  id?: string;
};

export default function HeadlineSection({
  label,
  title,
  headingLevel = 'h2',
  description,
  id,
}: HeadlineSectionProps) {
  const LabelHeading = headingLevel === 'h1' ? 'h1' : 'h2';
  const TitleHeading = headingLevel === 'h1' && !label ? 'h1' : headingLevel === 'h1' ? 'h2' : 'h3';

  return (
    <section id={id} className="pt-16 md:pt-32">
      {label && (
        <LabelHeading className="font-mono text-xs/5 font-semibold uppercase tracking-widest text-eleva-neutral-900/70">
          {label}
        </LabelHeading>
      )}
      <TitleHeading className="mt-2 text-pretty font-serif text-4xl font-light tracking-tighter text-eleva-neutral-900 sm:text-6xl">
        {title}
      </TitleHeading>
      <p className="mt-6 max-w-3xl text-2xl font-light text-eleva-neutral-900/80">{description}</p>
    </section>
  );
}
