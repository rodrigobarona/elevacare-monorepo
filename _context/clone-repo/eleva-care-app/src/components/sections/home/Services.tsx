'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceIcons } from '@/lib/icons/ServiceIcons';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type React from 'react';

type ServiceItem = {
  icon: string;
  title: string;
  description: string;
  subitems: string[];
  image: string;
  cta: string;
};

/**
 * Parse simple markdown bold syntax (**text**) to JSX
 * Lightweight alternative to ReactMarkdown (~50KB bundle reduction)
 *
 * Handles patterns like: "**Physical Therapy:** Description text"
 *
 * @param text - Text with optional **bold** markers
 * @returns JSX with <strong> tags for bold text
 */
function parseBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

const ServiceSection: React.FC = () => {
  const t = useTranslations('services');

  return (
    <section
      id="services"
      className="w-full bg-eleva-neutral-100 px-6 py-12 md:py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-2xl lg:max-w-7xl">
        <div className="mb-12">
          <h2 className="font-mono text-xs/5 font-normal uppercase tracking-widest text-eleva-neutral-900/70">
            {t('title')}
          </h2>
          <h3 className="mt-2 text-pretty font-serif text-4xl font-light tracking-tighter text-eleva-primary sm:text-6xl">
            {t('subtitle')}
          </h3>
        </div>
        <p className="mt-6 text-balance text-base font-light text-eleva-neutral-900 lg:text-xl">
          {t('description')}
        </p>
        <div className="mt-12 grid gap-2 md:grid-cols-2 md:gap-10 lg:grid-cols-2">
          {Array.from({ length: parseInt(t('itemCount')) }, (_, i): ServiceItem => {
            const key = (k: string) => t(k as Parameters<typeof t>[0]);
            return {
              icon: key(`item${i}.icon`),
              title: key(`item${i}.title`),
              description: key(`item${i}.description`),
              subitems: Array.from(
                { length: parseInt(key(`item${i}.subitemCount`)) },
                (_, j) => key(`item${i}.subitem${j}`),
              ),
              image: key(`item${i}.image`),
              cta: key(`item${i}.cta`),
            };
          }).map((service) => (
            <Card
              key={service.title}
              className="flex flex-col overflow-hidden border-[#0d6c70]/10 bg-eleva-neutral-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-2/3 max-h-72 w-full shrink-0 overflow-hidden">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 600px"
                  priority={false}
                />
              </div>

              <CardContent className="flex-1 p-6 pt-6">
                <div className="flex min-h-48 flex-col">
                  <div className="mb-4 flex items-center">
                    {ServiceIcons[service.icon as keyof typeof ServiceIcons]?.()}
                    <h3 className="ml-2 font-serif text-2xl font-normal text-eleva-primary">
                      {service.title}
                    </h3>
                  </div>
                  <p className="text-eleva-neutral-900">{service.description}</p>

                  <div className="mt-auto">
                    <Accordion type="single" collapsible>
                      <AccordionItem value="item-1">
                        <AccordionTrigger>{service.cta}</AccordionTrigger>
                        <AccordionContent>
                          <ul className="mt-4 list-inside list-disc text-eleva-neutral-900">
                            {service.subitems.map((item: string) => (
                              <li key={item} className="flex items-start pb-2 text-base">
                                <ChevronRight className="mr-2 mt-1 h-4 w-4 shrink-0" />
                                <span className="flex-1">{parseBold(item)}</span>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceSection;
