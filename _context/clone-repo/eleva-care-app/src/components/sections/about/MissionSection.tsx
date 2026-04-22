'use client';

import TextBlock from '@/components/shared/text/TextBlock';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

type MissionSectionProps = {
  title: string;
  description: Array<{ paragraph: string }>;
  statsTitle: string;
  stats: Array<{ label: string; value: string }>;
};

export default function MissionSection({
  title,
  description,
  statsTitle,
  stats,
}: MissionSectionProps) {
  return (
    <>
      <section className="mt-16 grid grid-cols-1 lg:grid-cols-2 lg:gap-12">
        <div className="max-w-lg">
          <h2 className="font-mono text-xs/5 font-normal uppercase tracking-widest text-eleva-neutral-900/70">
            {title}
          </h2>
          {description.map((item) => (
            <TextBlock key={item.paragraph}>{item.paragraph}</TextBlock>
          ))}
        </div>
        <div className="pt-20 lg:row-span-2 lg:-mr-16 xl:mr-auto">
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2 lg:gap-4 xl:gap-8">
            <div className="aspect-square overflow-hidden rounded-xl shadow-xl outline-1 -outline-offset-1 outline-black/10">
              <Image
                src="/img/Pregnant-Woman-Flowers.jpg"
                alt="Pregnant woman with flowers"
                width={300}
                height={450}
                className="block size-full object-cover"
              />
            </div>
            <div className="-mt-8 aspect-square overflow-hidden rounded-xl shadow-xl outline-1 -outline-offset-1 outline-black/10 lg:-mt-32">
              <Image
                src="/img/Woman-Working-Out-Living-Room.jpg"
                alt="Woman exercising"
                width={300}
                height={450}
                className="block size-full object-cover"
              />
            </div>
            <div className="aspect-square overflow-hidden rounded-xl shadow-xl outline-1 -outline-offset-1 outline-black/10">
              <Image
                src="/img/Smiling-Women-Photo.jpg"
                alt="Smiling women"
                width={300}
                height={450}
                className="block size-full object-cover"
              />
            </div>
            <div className="-mt-8 aspect-square overflow-hidden rounded-xl shadow-xl outline-1 -outline-offset-1 outline-black/10 lg:-mt-32">
              <Image
                src="/img/cancer-journey.jpg"
                alt="Supporting cancer journey"
                width={300}
                height={450}
                className="block size-full object-cover"
              />
            </div>
          </div>
        </div>

        <div className="max-lg:mt-16 lg:col-span-1">
          <h2 className="font-mono text-xs/5 font-normal uppercase tracking-widest text-eleva-neutral-900/70">
            {statsTitle}
          </h2>
          <Separator className="mt-6" />
          <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col gap-y-2 max-sm:border-b max-sm:border-dotted max-sm:border-eleva-neutral-200 max-sm:pb-4"
              >
                <dt className="text-sm/6 text-eleva-neutral-900/60">{stat.label}</dt>
                <dd className="order-first font-serif text-6xl font-light tracking-tighter text-eleva-primary">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
