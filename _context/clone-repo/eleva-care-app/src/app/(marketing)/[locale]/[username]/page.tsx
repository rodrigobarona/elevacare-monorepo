import { getProfileAccessData, ProfileAccessControl } from '@/components/auth/ProfileAccessControl';
import { EventBookingList } from '@/components/features/booking/EventBookingList';
import { ProfileColumnSkeleton } from '@/components/features/profile/ProfilePageLoadingSkeleton';
import { db } from '@/drizzle/db';
import { isReservedRoute } from '@/lib/constants/routes';
import { generateUserProfileMetadata } from '@/lib/seo/metadata-utils';
import { Instagram, Linkedin, Music, Twitter, Youtube } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import React from 'react';
import ReactMarkdown from 'react-markdown';

const SOCIAL_ICONS = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music, // Using Music icon for TikTok since there's no TikTok icon in Lucide
} as const;

// ProfileSkeleton moved to reusable component: ProfileColumnSkeleton
// Import from @/components/molecules/ProfilePageLoadingSkeleton

// Updated PageProps type with proper next params - params as Promise
interface PageProps {
  params: Promise<{
    username: string;
    locale: string;
  }>;
}

// Generate dynamic metadata for user profiles with OG images
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const { username, locale } = params;

  // Check if this is a reserved route - return default metadata
  if (isReservedRoute(username)) {
    return {
      title: 'Eleva Care',
      description: 'Mental health care platform',
    };
  }

  try {
    // Use the centralized utility to get profile data
    const data = await getProfileAccessData(username);

    if (!data) {
      return {
        title: 'User Not Found | Eleva Care',
        description: 'The requested user profile could not be found.',
      };
    }

    const { user } = data;

    // Get full profile data with relations for metadata
    const fullProfile = await db.query.ProfilesTable.findFirst({
      where: ({ workosUserId }, { eq }) => eq(workosUserId, user.id),
      with: {
        primaryCategory: true,
        secondaryCategory: true,
      },
    });

    // Check if profile is published - if not, return generic metadata
    if (!fullProfile?.published) {
      // TODO: Check if current user is the profile owner once session is available in metadata
      // For now, return generic metadata for unpublished profiles
      return {
        title: 'Profile Not Available | Eleva Care',
        description: 'This profile is not currently available.',
      };
    }

    // IMPORTANT: Always use ProfilesTable for display name on public expert profiles
    // ProfilesTable.firstName/lastName = Professional display name (e.g., "Dr. Patricia")
    // UsersTable.firstName/lastName = Legal name (e.g., "Patricia")
    // Expert chooses their public display name in their profile settings
    if (!fullProfile) {
      // If no profile exists, this shouldn't happen (ProfileAccessControl checks this)
      console.error(`[generateMetadata] No profile found for username: ${username}`);
      return {
        title: 'Profile Not Available | Eleva Care',
        description: 'This profile is not currently available.',
      };
    }

    const name = `${fullProfile.firstName} ${fullProfile.lastName}`;
    const bio = fullProfile?.shortBio || fullProfile?.longBio || undefined;
    const headline = fullProfile?.headline;

    // IMPORTANT: Use ProfilesTable.profilePicture for professional image
    // If not set, fallback to WorkOS (not cached UsersTable.imageUrl)
    const image = fullProfile?.profilePicture ?? undefined;

    // Extract specialties from categories
    const specialties: string[] = [];
    if (fullProfile?.primaryCategory) {
      specialties.push((fullProfile.primaryCategory as { name: string }).name);
    }
    if (fullProfile?.secondaryCategory) {
      specialties.push((fullProfile.secondaryCategory as { name: string }).name);
    }

    return generateUserProfileMetadata(
      locale as 'en' | 'es' | 'pt' | 'pt-BR',
      username,
      name,
      bio || undefined,
      image || undefined,
      headline || undefined,
      specialties,
    );
  } catch (error) {
    console.error('Error generating metadata for user profile:', error);

    // Fallback metadata
    return {
      title: `${username} | Eleva Care`,
      description: 'Healthcare expert profile on Eleva Care - Expert Healthcare for Women.',
    };
  }
}

export default async function UserLayout(props: PageProps) {
  const params = await props.params;
  const { username, locale } = params;

  // CRITICAL: Check if this is a reserved route
  // These routes have dedicated pages and should NOT be handled here
  if (isReservedRoute(username)) {
    console.log(`[UserLayout] Reserved route detected: ${username} - returning 404`);
    // Return 404 so Next.js falls through to the actual route
    return notFound();
  }

  return (
    <ProfileAccessControl username={username} context="UserLayout">
      <UserLayoutContent username={username} locale={locale} />
    </ProfileAccessControl>
  );
}

// Separate component for the actual content
async function UserLayoutContent({ username, locale }: { username: string; locale: string }) {
  console.log(`[UserLayoutContent] Loading page for username: ${username}, locale: ${locale}`);

  // Get user data - we know it exists because ProfileAccessControl validated it
  const data = await getProfileAccessData(username);
  if (!data) {
    return notFound(); // This shouldn't happen due to ProfileAccessControl
  }

  const { user } = data;
  console.log(`[UserLayoutContent] Found user: ${user.id} for username: ${username}`);

  return (
    <div className="container max-w-7xl pb-10 pt-32">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[400px_1fr]">
        {/* Left Column - Profile Info with Suspense */}
        <React.Suspense fallback={<ProfileColumnSkeleton />}>
          <ProfileInfo username={username} locale={locale} workosUserId={user.id} />
        </React.Suspense>

        {/* Right Column - Content */}
        <div className="space-y-6">
          <EventBookingList userId={user.id} username={username} />
        </div>
      </div>
    </div>
  );
}

// Separate component for profile info
interface ProfileInfoProps {
  username: string;
  locale: string;
  workosUserId: string;
}

async function ProfileInfo({
  username: _username,
  locale: _locale,
  workosUserId,
}: ProfileInfoProps) {
  try {
    console.log(`[ProfileInfo] Loading profile for workosUserId: ${workosUserId}`);

    const profile = await db.query.ProfilesTable.findFirst({
      where: ({ workosUserId: profileClerkUserId }, { eq }) => eq(profileClerkUserId, workosUserId),
      with: {
        primaryCategory: true,
        secondaryCategory: true,
      },
    });

    console.log(
      `[ProfileInfo] Profile found: ${profile ? 'yes' : 'no'} for workosUserId: ${workosUserId}`,
    );

    // CRITICAL: ProfilesTable MUST exist for public expert pages
    // ProfileAccessControl ensures this, but double-check here
    if (!profile) {
      console.error(`[ProfileInfo] No profile found for workosUserId: ${workosUserId}`);
      throw new Error('Profile not found');
    }

    // Display name from ProfilesTable (professional name chosen by expert)
    const displayName = `${profile.firstName} ${profile.lastName}`;

    // IMPORTANT: Use ProfilesTable.profilePicture for professional image
    // If not set, we could fetch from WorkOS API here, but for now use default
    // TODO: Fetch from WorkOS API if profile.profilePicture is null
    const profileImage = profile.profilePicture || '/img/default-avatar.png';

    return (
      <div className="space-y-6">
        <div className="relative aspect-18/21 w-full overflow-hidden rounded-lg">
          <Image
            src={profileImage}
            alt={displayName}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          {/* Top Expert Badge */}
          {profile.isTopExpert && (
            <div className="absolute bottom-4 left-3">
              <span className="rounded-sm bg-white px-3 py-2 text-base font-medium text-eleva-neutral-900">
                <span>Top Expert</span>
              </span>
            </div>
          )}
        </div>
        <div className="space-y-12">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-medium">
              {displayName}
              {profile?.isVerified && (
                <Image
                  src="/img/expert-verified-icon.svg"
                  alt=""
                  className="h-5 w-5"
                  aria-hidden="true"
                  width={32}
                  height={32}
                />
              )}
            </h1>
            {profile?.headline && (
              <p className="text-sm font-medium text-eleva-neutral-900/60">{profile.headline}</p>
            )}
            {/* Categories */}
            {(profile?.primaryCategory || profile?.secondaryCategory) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.primaryCategory && (
                  <span className="rounded-full bg-eleva-neutral-100 px-3 py-1 text-sm font-medium text-eleva-neutral-900">
                    {(profile.primaryCategory as { name: string }).name}
                  </span>
                )}
                {profile.secondaryCategory && (
                  <span className="rounded-full bg-eleva-neutral-100 px-3 py-1 text-sm font-medium text-eleva-neutral-900">
                    {(profile.secondaryCategory as { name: string }).name}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <h2 className="flex w-full items-center justify-between text-xl font-medium text-eleva-neutral-900">
              About me
              {profile?.socialLinks && profile.socialLinks.length > 0 && (
                <div className="flex gap-3">
                  {profile.socialLinks.map((link: { name: string; url: string }) => {
                    if (!link.url) return null;
                    const Icon = SOCIAL_ICONS[link.name as keyof typeof SOCIAL_ICONS];
                    return (
                      <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noopener nofollow noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {Icon && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-eleva-neutral-200 p-1">
                            <Icon className="h-5 w-5 text-eleva-neutral-900" />
                          </span>
                        )}
                        <span className="sr-only">{link.name}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </h2>
            {profile?.longBio && (
              <div className="prose-eleva-neutral-900 prose-font-light prose prose-base">
                <ReactMarkdown>{profile.longBio}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error(`[ProfileInfo] Error loading profile for workosUserId: ${workosUserId}:`, error);
    // Re-throw the error to let the parent component handle it
    throw error;
  }
}
