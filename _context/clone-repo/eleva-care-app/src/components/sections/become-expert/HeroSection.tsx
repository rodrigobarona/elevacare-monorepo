import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface HeroSectionProps {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  ctaButton: string;
  signInButton: string;
  features: string;
}

export default function HeroSection({
  badge,
  title,
  subtitle,
  description,
  ctaButton,
  signInButton,
  features,
}: HeroSectionProps) {
  return (
    <section className="container relative mx-auto px-4 py-20 md:py-32">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-block rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          <Sparkles className="mr-2 inline h-4 w-4" />
          {badge}
        </div>

        <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          {title}
          <br />
          <span className="bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            {subtitle}
          </span>
        </h1>

        <p className="mb-8 text-lg text-muted-foreground md:text-xl">{description}</p>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="text-lg">
            <Link href="/register?expert=true">
              {ctaButton} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg">
            <Link href="/login">{signInButton}</Link>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">{features}</p>
      </div>
    </section>
  );
}
