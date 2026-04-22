'use client';

import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

type Advisor = {
  name: string;
  flags: string;
  role: string;
  quote: string;
  image: string;
};

type AdvisorsSectionProps = {
  title: string;
  healthcareAdvisors: Advisor[];
};

export default function AdvisorsSection({
  title,

  healthcareAdvisors,
}: AdvisorsSectionProps) {
  return (
    <section>
      <h3 className="mt-24 font-mono text-xs/5 font-normal uppercase tracking-widest text-eleva-neutral-900/70">
        {title}
      </h3>
      <Separator className="mt-6" />
      <ul className="mx-auto mt-10 grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-3">
        {healthcareAdvisors.map((advisor) => (
          <li key={advisor.name}>
            <div className="flex flex-col items-center gap-4 text-center">
              <Image
                src={advisor.image}
                alt={advisor.name}
                width={200}
                height={200}
                className="size-40 rounded-full object-cover"
              />
              <div>
                <h4 className="font-medium text-eleva-primary">
                  {advisor.name} {advisor.flags}
                </h4>
                <p className="font-mono text-xs text-eleva-neutral-900">{advisor.role}</p>
              </div>
              <blockquote className="max-w-sm font-serif text-sm/6 italic text-eleva-neutral-900/60">
                {advisor.quote}
              </blockquote>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
