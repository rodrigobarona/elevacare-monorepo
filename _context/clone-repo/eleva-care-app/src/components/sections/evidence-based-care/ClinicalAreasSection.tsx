'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BookOpen } from 'lucide-react';

interface Research {
  authors: string;
  year: string;
  doi: string;
  title: string;
}

interface ClinicalArea {
  id: string;
  title: string;
  description: string;
  keyFinding: string;
  research: Research[];
}

interface ClinicalAreasSectionProps {
  title: string;
  subtitle: string;
  areas: ClinicalArea[];
}

/**
 * Reference component with tooltip preview (Apple/Sword Health style)
 * Links to the full reference at the bottom of the page
 * Uses Eleva brand colors
 */
function ResearchReference({ paper, index }: { paper: Research; index: number }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <a
          href={`#ref-${index}`}
          className="inline-flex items-baseline text-eleva-primary hover:underline hover:text-eleva-primary-light"
          aria-label={`Reference ${index}: ${paper.title}`}
        >
          <sup className="mx-0.5 font-semibold">[{index}]</sup>
        </a>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm border-eleva-primary/20 bg-eleva-neutral-900">
        <div className="space-y-1">
          <p className="text-xs font-medium leading-snug text-white">{paper.title}</p>
          <p className="text-xs text-eleva-neutral-200">
            {paper.authors} ({paper.year})
          </p>
          <p className="mt-1 text-xs text-eleva-primary-light">
            Click to see full reference ↓
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default function ClinicalAreasSection({ title, subtitle, areas }: ClinicalAreasSectionProps) {
  // Flatten all research papers for reference numbering
  const allResearch: Array<{ paper: Research; areaId: string }> = [];
  areas.forEach((area) => {
    area.research.forEach((paper) => {
      allResearch.push({ paper, areaId: area.id });
    });
  });

  return (
    <TooltipProvider>
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
        {/* Header - Radiant style */}
        <div className="mb-16 text-center">
          <h2 className="mb-6 font-serif text-4xl font-light tracking-tight text-eleva-neutral-900 md:text-5xl">
            {title}
          </h2>
          <p className="mx-auto max-w-2xl text-balance text-lg leading-relaxed text-eleva-neutral-900/70">
            {subtitle}
          </p>
        </div>

        {/* Accordion - Improved readability */}
        <Accordion type="single" collapsible className="w-full space-y-4">
          {areas.map((area) => {
            // Get reference indices for this area
            const startIdx = allResearch.findIndex((r) => r.areaId === area.id);
            const areaRefs = allResearch
              .slice(startIdx, startIdx + area.research.length)
              .map((_, idx) => startIdx + idx + 1);

            return (
              <AccordionItem
                key={area.id}
                value={area.id}
                className="rounded-xl border border-eleva-neutral-200 bg-white px-6 shadow-xs transition-all hover:border-eleva-primary/30 hover:shadow-md"
              >
                <AccordionTrigger className="py-6 text-left text-xl font-semibold tracking-tight text-eleva-neutral-900 transition-colors hover:text-eleva-primary hover:no-underline">
                  {area.title}
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pb-6 pt-2">
                  {/* Description - Better typography */}
                  <p className="text-base leading-relaxed text-eleva-neutral-900/80">
                    {area.description}
                    {/* Inline references */}
                    {areaRefs.map((refNum) => (
                      <ResearchReference
                        key={refNum}
                        paper={allResearch[refNum - 1].paper}
                        index={refNum}
                      />
                    ))}
                  </p>

                  {/* Key Finding - Eleva brand colors */}
                  <div className="relative overflow-hidden rounded-lg border border-eleva-primary/20 bg-linear-to-br from-eleva-accent/40 via-eleva-primary-light/10 to-eleva-accent/40 p-6 shadow-xs">
                    <div className="relative">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="rounded-md bg-eleva-primary/10 p-1.5">
                          <BookOpen className="h-4 w-4 text-eleva-primary" />
                        </div>
                        <p className="text-sm font-semibold uppercase tracking-wider text-eleva-primary">
                          Key Finding
                        </p>
                      </div>
                      <p className="text-base leading-relaxed text-eleva-neutral-900">
                        {area.keyFinding}
                      </p>
                    </div>
                    {/* Decorative accent */}
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-eleva-highlight-yellow/20 blur-2xl" />
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

      </div>
    </section>
    </TooltipProvider>
  );
}
