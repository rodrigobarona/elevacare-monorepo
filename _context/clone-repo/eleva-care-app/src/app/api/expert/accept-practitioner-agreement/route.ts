/**
 * Practitioner Agreement Acceptance Endpoint (AuthKit)
 *
 * Records when an expert accepts the practitioner agreement (required for GDPR/HIPAA compliance).
 * This creates an audit trail that can be used for legal compliance and investigations.
 *
 * @route POST /api/expert/accept-practitioner-agreement
 */
import * as Sentry from '@sentry/nextjs';
import { db } from '@/drizzle/db';
import { ProfilesTable } from '@/drizzle/schema';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const { logger } = Sentry;

const acceptPractitionerAgreementSchema = z.object({
  version: z.string().min(1, 'Agreement version is required'),
  accepted: z.literal(true, { error: 'Agreement must be accepted (accepted: true)' }),
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const { user } = await withAuth({ ensureSignedIn: true });

    const bodyResult = acceptPractitionerAgreementSchema.safeParse(await request.json());
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.flatten() },
        { status: 400 },
      );
    }
    const { version } = bodyResult.data;

    // 3. Get comprehensive geolocation and request data from Vercel headers
    const headersList = await headers();

    // IP Address
    const ipAddress =
      headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
      headersList.get('x-real-ip') ||
      'unknown';

    // Geolocation data from Vercel
    const city = headersList.get('x-vercel-ip-city');
    const country = headersList.get('x-vercel-ip-country');
    const region = headersList.get('x-vercel-ip-country-region');
    const timezone = headersList.get('x-vercel-ip-timezone');
    const latitude = headersList.get('x-vercel-ip-latitude');
    const longitude = headersList.get('x-vercel-ip-longitude');
    const postalCode = headersList.get('x-vercel-ip-postal-code');
    const continent = headersList.get('x-vercel-ip-continent');

    // User agent for device/browser info
    const userAgent = headersList.get('user-agent');

    // Build comprehensive metadata for audit trail
    const metadata = {
      ip: ipAddress,
      city: city || undefined,
      country: country || undefined,
      region: region || undefined,
      timezone: timezone || undefined,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
      postalCode: postalCode || undefined,
      continent: continent || undefined,
      userAgent: userAgent || undefined,
      timestamp: new Date().toISOString(),
    };

    // 4. Update profile with acceptance details and comprehensive metadata
    const [profile] = await db
      .update(ProfilesTable)
      .set({
        practitionerAgreementAcceptedAt: new Date(),
        practitionerAgreementVersion: version,
        practitionerAgreementIpAddress: ipAddress,
        practitionerAgreementMetadata: metadata, // Store all geolocation data as JSON
        updatedAt: new Date(),
      })
      .where(eq(ProfilesTable.workosUserId, user.id))
      .returning();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 5. Return success
    return NextResponse.json({
      success: true,
      data: {
        acceptedAt: profile.practitionerAgreementAcceptedAt,
        version: profile.practitionerAgreementVersion,
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Failed to record practitioner agreement', { error });
    return NextResponse.json({ error: 'Failed to record agreement acceptance' }, { status: 500 });
  }
}

/**
 * GET /api/expert/accept-practitioner-agreement
 *
 * Check if the current user has accepted the practitioner agreement.
 */
export async function GET() {
  try {
    // 1. Authenticate user
    const { user } = await withAuth({ ensureSignedIn: true });

    // 2. Get profile
    const [profile] = await db
      .select({
        acceptedAt: ProfilesTable.practitionerAgreementAcceptedAt,
        version: ProfilesTable.practitionerAgreementVersion,
      })
      .from(ProfilesTable)
      .where(eq(ProfilesTable.workosUserId, user.id))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 3. Return status
    return NextResponse.json({
      success: true,
      data: {
        hasAccepted: !!profile.acceptedAt,
        acceptedAt: profile.acceptedAt,
        version: profile.version,
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Failed to check practitioner agreement status', { error });
    return NextResponse.json({ error: 'Failed to check agreement status' }, { status: 500 });
  }
}
