import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQSectionProps {
  title: string;
  subtitle: string;
  faqs: FAQItem[];
}

export default function FAQSection({ title, subtitle, faqs }: FAQSectionProps) {
  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-4xl">
        {/* Header - Radiant style */}
        <div className="mb-16 text-center">
          <h2 className="mb-6 font-serif text-4xl font-light tracking-tight text-eleva-neutral-900 md:text-5xl">
            {title}
          </h2>
          <p className="mx-auto max-w-2xl text-balance text-lg leading-relaxed text-eleva-neutral-900/70">
            {subtitle}
          </p>
        </div>

        {/* FAQ Accordion - Improved spacing and typography */}
        <Accordion type="single" collapsible className="w-full space-y-4">
          {faqs.map((faq) => (
            <AccordionItem
              key={faq.id}
              value={faq.id}
              className="rounded-xl border border-eleva-neutral-200 bg-white px-6 shadow-xs transition-all hover:border-eleva-primary/30 hover:shadow-md"
            >
              <AccordionTrigger className="py-6 text-left text-lg font-semibold tracking-tight text-eleva-neutral-900 transition-colors hover:text-eleva-primary hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="pb-6 pt-2 text-base leading-relaxed text-eleva-neutral-900/80">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

