'use client';

import { Button } from '@/components/ui/button';

type Benefit = {
  title: string;
  description: string;
};

type JoinNetworkSectionProps = {
  title: string;
  benefits: Benefit[];
  applyUrl: string;
  applyButtonText: string;
};

export default function JoinNetworkSection({
  title,
  benefits,
  applyUrl,
  applyButtonText,
}: JoinNetworkSectionProps) {
  return (
    <section className="mt-12">
      <div className="mt-24 grid grid-cols-1 gap-16 lg:grid-cols-[1fr_24rem]">
        <div className="lg:max-w-2xl">
          <h3 className="font-mono text-xs/5 font-normal uppercase tracking-widest text-eleva-neutral-900/70">
            {title}
          </h3>
          <ul className="mt-8 space-y-8">
            {benefits.map((benefit) => (
              <li key={benefit.title}>
                <h4 className="font-serif text-xl font-light tracking-tighter text-eleva-primary">
                  {benefit.title}
                </h4>
                <p className="mt-3 text-base/6 text-eleva-neutral-900/60">{benefit.description}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <a href={applyUrl} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="rounded-full">
                {applyButtonText}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
