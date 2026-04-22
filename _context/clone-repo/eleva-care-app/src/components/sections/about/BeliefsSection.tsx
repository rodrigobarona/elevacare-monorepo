'use client';

import { Separator } from '@/components/ui/separator';

type BeliefCardProps = {
  title: string;
  beliefs: Array<{ title: string; description: string }>;
};

export default function BeliefCard({ title, beliefs }: BeliefCardProps) {
  return (
    <>
      <section className="mt-24">
        <h2 className="font-mono text-xs/5 font-normal uppercase tracking-widest text-eleva-neutral-900/70">
          {title}
        </h2>
        <Separator className="mt-6" />
        <ul className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {beliefs.map((belief) => (
            <li className="list-none" key={belief.title}>
              <h3 className="font-serif text-xl font-light tracking-tighter text-eleva-primary">
                {belief.title}
              </h3>
              <p className="mt-4 text-base/6 text-eleva-neutral-900/60">{belief.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
