import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface Publication {
  title: string;
  journal: string;
  year: string;
  doi: string;
}

interface Researcher {
  name: string;
  credentials: string;
  specialization: string;
  image: string;
  impactStatement: string;
  publications: Publication[];
}

interface ResearchTeamSectionProps {
  title: string;
  subtitle: string;
  researchers: Researcher[];
}

export default function ResearchTeamSection({ title, subtitle, researchers }: ResearchTeamSectionProps) {
  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">{subtitle}</p>
        </div>

        {/* Researchers Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {researchers.map((researcher, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="p-0">
                <div className="relative h-48 w-full overflow-hidden bg-muted">
                  <Image
                    src={researcher.image}
                    alt={`${researcher.name} - ${researcher.credentials}`}
                    fill
                    className="object-cover"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <h3 className="mb-1 text-xl font-bold">{researcher.name}</h3>
                <p className="mb-2 text-sm font-medium text-primary">{researcher.credentials}</p>
                <p className="mb-3 text-sm text-muted-foreground">{researcher.specialization}</p>

                <div className="mb-4 rounded-lg bg-muted/50 p-3">
                  <p className="text-sm italic">&ldquo;{researcher.impactStatement}&rdquo;</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Key Publications:</p>
                  {researcher.publications.map((pub, idx) => (
                    <div key={idx} className="border-l-2 border-primary/30 pl-3">
                      <p className="text-xs font-medium">{pub.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {pub.journal} ({pub.year})
                      </p>
                      <a
                        href={`https://doi.org/${pub.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        aria-label={`Read publication: ${pub.title} (opens in new tab)`}
                      >
                        DOI: {pub.doi}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

