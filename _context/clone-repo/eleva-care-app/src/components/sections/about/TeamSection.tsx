'use client';

import TextBlock from '@/components/shared/text/TextBlock';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import Link from 'next/link';

type TeamMember = {
  name: string;
  flags: string;
  role: string;
  image: string;
};

type TeamSectionProps = {
  title: string;
  description: Array<{ paragraph: string }>;
  leadership: TeamMember[];
  ctaText?: string;
  ctaLink?: string;
};

export default function TeamSection({
  title,
  description,
  leadership,
  ctaText,
  ctaLink,
}: TeamSectionProps) {
  return (
    <>
      <section className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="max-w-xl">
          {description.map((item) => (
            <TextBlock key={item.paragraph}>{item.paragraph}</TextBlock>
          ))}
        </div>

        <div className="flex justify-center max-lg:order-first max-lg:max-w-lg">
          <div className="aspect-3/2 max-w-96 overflow-hidden rounded-xl shadow-xl outline-1 -outline-offset-1 outline-black/10">
            <Image
              src="/img/about/team-photo.png"
              alt="Eleva Care team meeting"
              width={300}
              height={200}
              className="block size-full object-cover"
            />
          </div>
        </div>

        {ctaText && ctaLink && (
          <div className="mt-1">
            <Link href={ctaLink}>
              <Button size="lg" className="rounded-full">
                {ctaText}
              </Button>
            </Link>
          </div>
        )}
        <div className="mt-16 lg:col-span-2">
          <h3 className="font-mono text-xs/5 font-normal uppercase tracking-widest text-eleva-neutral-900/70">
            {title}
          </h3>
          <Separator className="mt-6" />
          <ul className="mx-auto mt-16 grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2">
            {leadership.map((member) => (
              <li key={member.name} className="flex items-center gap-4">
                <Image
                  src={member.image}
                  alt={member.name}
                  width={200}
                  height={200}
                  className="size-40 rounded-full object-cover"
                />
                <div className="text-sm/6">
                  <h3 className="font-medium text-eleva-primary">
                    {member.name} {member.flags}
                  </h3>
                  <p className="font-mono text-xs text-eleva-neutral-900">{member.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
