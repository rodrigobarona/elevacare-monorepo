import * as Sentry from '@sentry/nextjs';
import { db, invalidateCache } from '@/drizzle/db';
import { ProfilesTable } from '@/drizzle/schema';

const { logger } = Sentry;
import { profileFormSchema } from '@/schema/profile';
import { markStepComplete } from '@/server/actions/expert-setup';
import { del } from '@vercel/blob';
import type { z } from 'zod';

/**
 * Type definition for the profile form values, derived from the Zod schema
 */
type ProfileFormValues = z.infer<typeof profileFormSchema>;

/**
 * Updates an expert's profile information, including profile picture and social media links.
 *
 * This function performs several operations:
 * 1. Retrieves the existing profile to handle profile picture updates
 * 2. Manages blob storage for profile pictures (deleting old ones if necessary)
 * 3. Normalizes social media links to full URLs
 * 4. Validates and saves the updated profile data
 *
 * @param userId - The WorkOS user ID of the expert
 * @param data - The profile data to be updated, including:
 *   - firstName: Expert's first name
 *   - lastName: Expert's last name
 *   - headline: Professional headline
 *   - shortBio: Brief biography
 *   - profilePicture: URL of the profile picture
 *   - socialLinks: Array of social media links
 * @returns Object indicating success or failure of the operation
 *
 * @example
 * const result = await updateProfile("user_123", {
 *   firstName: "John",
 *   lastName: "Doe",
 *   headline: "Expert Consultant",
 *   shortBio: "15+ years of experience in consulting",
 *   profilePicture: "https://example.com/picture.jpg",
 *   socialLinks: [
 *     { name: "twitter", url: "@johndoe" },
 *     { name: "linkedin", url: "johndoe" }
 *   ]
 * });
 *
 * if (result.error) {
 *   console.error("Profile update failed:", result.error);
 * }
 */
export async function updateProfile(userId: string, data: ProfileFormValues) {
  return Sentry.withServerActionInstrumentation('updateProfile', { recordResponse: true }, async () => {
  try {
    const existingProfile = await db.query.ProfilesTable.findFirst({
      where: (profile, { eq }) => eq(profile.workosUserId, userId),
    });

    // Handle profile picture blob management
    if (
      existingProfile?.profilePicture?.includes('public.blob.vercel-storage.com') &&
      existingProfile.profilePicture !== data.profilePicture
    ) {
      try {
        // Delete old profile picture from blob storage
        await del(existingProfile.profilePicture);
      } catch (error) {
        logger.error('Failed to delete old profile picture', { error });
        // Continue execution even if deletion fails
      }
    }

    // Transform and validate social media links
    const transformedData = {
      ...data,
      socialLinks: data.socialLinks.map((link) => {
        // Handle empty or undefined URLs
        if (!link.url?.trim()) {
          return { name: link.name, url: '' };
        }

        // Validate and return full URLs if provided
        if (link.url.startsWith('http')) {
          try {
            new URL(link.url); // Validate URL format
            return { name: link.name, url: link.url };
          } catch {
            return { name: link.name, url: '' };
          }
        }

        // Process username-based social media links
        const username = link.url.replace(/^@/, '').trim();
        if (!username || !/^[a-zA-Z0-9._-]+$/.test(username)) {
          return { name: link.name, url: '' };
        }

        // Convert usernames to full URLs based on platform
        switch (link.name) {
          case 'instagram':
            return {
              name: link.name,
              url: `https://instagram.com/${username}`,
            };
          case 'twitter':
            return { name: link.name, url: `https://x.com/${username}` };
          case 'linkedin':
            return {
              name: link.name,
              url: `https://linkedin.com/in/${username}`,
            };
          case 'youtube':
            return { name: link.name, url: `https://youtube.com/@${username}` };
          case 'tiktok':
            return { name: link.name, url: `https://tiktok.com/@${username}` };
          default:
            return link;
        }
      }),
      // Preserve existing profile picture if none provided
      profilePicture: data.profilePicture || existingProfile?.profilePicture || null,
    };

    // Validate transformed data against schema
    const validatedData = await profileFormSchema.parseAsync(transformedData);

    // Upsert the profile data
    await db
      .insert(ProfilesTable)
      .values({
        ...validatedData,
        workosUserId: userId,
        socialLinks: validatedData.socialLinks as Array<{
          name: 'tiktok' | 'twitter' | 'linkedin' | 'instagram' | 'youtube';
          url: string;
        }>,
      })
      .onConflictDoUpdate({
        target: ProfilesTable.workosUserId,
        set: {
          ...validatedData,
          socialLinks: validatedData.socialLinks as Array<{
            name: 'tiktok' | 'twitter' | 'linkedin' | 'instagram' | 'youtube';
            url: string;
          }>,
        },
      });

    // Check if required profile fields are filled out and mark step as complete
    if (validatedData.firstName && validatedData.lastName && validatedData.shortBio) {
      try {
        await markStepComplete('profile');
      } catch (error) {
        logger.error('Failed to mark profile step as complete', { error });
      }
    }

    await invalidateCache([`expert-profile-${userId}`]);

    return { success: true };
  } catch (error) {
    logger.error('Profile update error', { error });
    return { error: 'Failed to update profile' };
  }
  });
}
