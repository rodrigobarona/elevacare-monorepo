import { Button } from '@/components/ui/button';
import { ArrowRight, Zap } from 'lucide-react';
import Link from 'next/link';

interface FinalCTASectionProps {
  title: string;
  description: string;
  button: string;
  questions: string;
  contact: string;
}

export default function FinalCTASection({
  title,
  description,
  button,
  questions,
  contact,
}: FinalCTASectionProps) {
  return (
    <section className="bg-linear-to-r from-primary/10 via-purple-500/10 to-primary/10 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Zap className="mx-auto mb-6 h-16 w-16 text-primary" />
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">{title}</h2>
          <p className="mb-8 text-lg text-muted-foreground">{description}</p>
          <Button asChild size="lg" className="text-lg">
            <Link href="/register?expert=true">
              {button} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            {questions}{' '}
            <Link href="/support" className="text-primary hover:underline">
              {contact}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
