import { PlatformDisclaimer } from '@/components/shared/ui-utilities/PlatformDisclaimer';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { db } from '@/drizzle/db';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';

const ExpertsSection = async () => {
  const t = await getTranslations('experts');

  // Optimize: Get only published profiles with necessary fields and limit to top experts
  const profiles = await db.query.ProfilesTable.findMany({
    where: ({ published }) => eq(published, true),
    with: {
      primaryCategory: true,
    },
    orderBy: ({ order }) => order,
    limit: 12, // Limit to top 12 experts for better performance
  });

  // Early return if no profiles
  if (profiles.length === 0) {
    return null;
  }

  // Get user data from database for username (using WorkOS IDs)
  const userPromises = profiles.map((profile) =>
    db.query.UsersTable.findFirst({
      where: ({ workosUserId }) => eq(workosUserId, profile.workosUserId),
      columns: { username: true, workosUserId: true },
    }),
  );
  const users = await Promise.all(userPromises);

  const expertsData = await Promise.all(
    profiles.map(async (profile, index) => {
      const user = users[index];

      if (!user) return null;

      return {
        id: profile.workosUserId,
        name: `${profile.firstName} ${profile.lastName}`,
        username: user.username,
        image: profile.profilePicture || '/images/placeholder-avatar.png',
        headline: profile.headline || '',
        shortBio: profile.shortBio || '',
        order: profile.order || 0,
        rating: '5.0',
        isTopExpert: profile.isTopExpert,
        isVerified: profile.isVerified,
        category: profile.primaryCategory?.name || '',
      };
    }),
  );

  // Filter out any null values (shouldn't happen) and profiles without prices
  const expertsWithPricing = expertsData
    .filter((expert): expert is NonNullable<typeof expert> => expert !== null)
    .sort((a, b) => {
      // First sort by order (lower numbers come first)
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      // If order is the same, sort by name as secondary criteria
      return a.name.localeCompare(b.name);
    });

  return (
    <section id="experts" className="w-full px-6 pb-24 pt-12 md:py-24 lg:px-8 lg:py-32">
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
          {t('description')}{' '}
          <PlatformDisclaimer>
            <button className="inline underline decoration-eleva-neutral-900/30 underline-offset-2 transition-colors hover:text-eleva-primary hover:decoration-eleva-primary">
              {t('disclaimerLink')}
            </button>
          </PlatformDisclaimer>
        </p>
        <Carousel
          className="-ml-2 mt-10"
          opts={{
            align: 'start',
            loop: false,
          }}
        >
          <CarouselContent className="-ml-6 pl-2 pt-1">
            {expertsWithPricing.map((expert) => (
              <CarouselItem
                key={expert.id}
                className="basis-[85%] pl-6 sm:basis-[45%] md:basis-1/2 lg:basis-[22%]"
              >
                <Link
                  href={`/${expert.username}`}
                  className="group overflow-visible"
                  prefetch={false}
                >
                  <Card className="overflow-visible border-none bg-transparent shadow-none">
                    {/* Image Container */}
                    <div className="relative aspect-28/38 rounded-xl transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-xl">
                      <Image
                        src={expert.image}
                        alt={t('expertImageAlt', { name: expert.name })}
                        width={400}
                        height={520}
                        className="absolute inset-0 h-full w-full overflow-hidden rounded-xl object-cover"
                        loading="lazy"
                        quality={85}
                        sizes="(max-width: 767px) 85vw, (max-width: 1023px) 45vw, 22vw"
                        placeholder="blur"
                        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjUyMCIgZmlsbD0iI2YzZjRmNiIvPjwvc3ZnPg=="
                      />
                      {/* Top Expert Badge */}
                      {expert.isTopExpert && (
                        <div className="absolute bottom-4 left-4">
                          <span className="rounded-sm bg-white px-3 py-2 text-base font-medium text-eleva-neutral-900">
                            <span>{t('topExpertBadge')}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content Container */}
                    <CardContent className="space-y-1 px-0 pt-4">
                      {/* Name and Rating */}
                      <div className="flex items-start justify-between">
                        <div className="flex w-full items-center justify-between">
                          <h3 className="flex items-center gap-1 text-lg font-semibold text-eleva-neutral-900">
                            {expert.name}
                            {expert.isVerified && (
                              <Image
                                src="/img/expert-verified-icon.svg"
                                alt={t('verifiedBadgeAlt')}
                                className="h-4 w-4"
                                aria-hidden="true"
                                width={16}
                                height={16}
                              />
                            )}
                          </h3>
                          <div className="ml-auto flex items-center gap-1">
                            <span className="text-xs text-amber-400" aria-hidden="true">
                              ★
                            </span>
                            <span className="text-xs font-light text-eleva-neutral-900">
                              {expert.rating}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Category */}
                      {expert.category && (
                        <div className="flex items-center gap-2 pb-3 text-sm font-light text-eleva-neutral-900/80">
                          {expert.category}
                        </div>
                      )}

                      {/* Short Bio */}
                      <p className="text-balance text-base font-light text-eleva-neutral-900/80">
                        {expert.shortBio}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          {expertsWithPricing.length > 4 && (
            <div className="absolute right-12 mt-8 hidden h-10 w-6 flex-row items-end justify-end lg:flex">
              <CarouselPrevious className="h-12 w-12" />
              <CarouselNext className="h-12 w-12" />
            </div>
          )}
        </Carousel>
      </div>
    </section>
  );
};

export default ExpertsSection;
