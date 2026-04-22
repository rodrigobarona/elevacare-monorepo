import { getProfileAccessData, ProfileAccessControl } from '@/components/auth/ProfileAccessControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerStripe } from '@/lib/integrations/stripe';
import { db } from '@/drizzle/db';
import { formatDateTime } from '@/lib/utils/formatters';
import { Calendar, CheckCircle, Clock, CreditCard, User } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';

// Note: Route is dynamic by default with cacheComponents enabled in Next.js 16
// Removed: export const revalidate = 0 (default behavior)
// Removed: export const dynamic = 'force-dynamic' (no longer needed)

// Updated PageProps type with proper next params - both params and searchParams as Promises
interface PageProps {
  params: Promise<{
    username: string;
    eventSlug: string;
    locale: string;
  }>;
  searchParams: Promise<{
    startTime: string;
    session_id?: string;
    timezone?: string;
  }>;
}

export default async function SuccessPage(props: PageProps) {
  const params = await props.params;
  const { username, eventSlug } = params;

  return (
    <ProfileAccessControl username={username} context="SuccessPage" additionalPath={eventSlug}>
      <SuccessPageContent props={props} />
    </ProfileAccessControl>
  );
}

// Separate component for the actual content
async function SuccessPageContent({ props }: { props: PageProps }) {
  const t = await getTranslations('experts');

  // Await both params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  const { startTime, session_id, timezone } = searchParams;

  // Get the user's timezone either from the URL or use the cookie as fallback
  // This ensures we display the time in the user's local timezone
  const cookieStore = await cookies();
  const userTimezone = timezone || cookieStore.get('user-timezone')?.value || 'UTC';

  const { username, eventSlug, locale } = params;

  // Get user data - we know it exists because ProfileAccessControl validated it
  const data = await getProfileAccessData(username);
  if (!data) {
    return notFound(); // This shouldn't happen due to ProfileAccessControl
  }

  const { user } = data;

  const event = await db.query.EventsTable.findFirst({
    where: ({ workosUserId: userIdCol, isActive, slug }, { eq, and }) =>
      and(eq(isActive, true), eq(userIdCol, user.id), eq(slug, eventSlug)),
  });

  if (event == null) notFound();

  // Get expert profile data
  const expertProfile = await db.query.ProfilesTable.findFirst({
    where: ({ workosUserId }, { eq }) => eq(workosUserId, user.id),
    with: {
      primaryCategory: true,
    },
  });

  // Fetch user from database (WorkOS)
  const calendarUser = await db.query.UsersTable.findFirst({
    where: (users, { eq }) => eq(users.workosUserId, user.id),
  });

  // Handle case where user is not found
  if (!calendarUser) {
    return notFound();
  }

  // Validate startTime before creating Date object
  let startTimeDate: Date;
  try {
    if (!startTime) throw new Error('Missing startTime');
    startTimeDate = new Date(startTime);
    if (Number.isNaN(startTimeDate.getTime())) throw new Error('Invalid date');
  } catch (error) {
    console.error('Invalid startTime:', startTime, error);
    return notFound();
  }

  // Verify that the meeting was actually created
  const meeting = await db.query.MeetingsTable.findFirst({
    where: ({ eventId, startTime: meetingStartTime, stripeSessionId }, { eq, and, or }) =>
      and(
        eq(eventId, event.id),
        eq(meetingStartTime, startTimeDate),
        session_id ? or(eq(stripeSessionId, session_id)) : undefined,
      ),
  });

  // If meeting exists, show success page
  if (meeting) {
    // We prioritize the meeting's stored timezone if available
    const displayTimezone = meeting.timezone || userTimezone;

    // IMPORTANT: Use ProfilesTable for expert display name (professional name)
    // If no profile exists, this shouldn't happen (required for public expert pages)
    if (!expertProfile) {
      console.error('[SuccessPage] No expert profile found for:', calendarUser.workosUserId);
      return notFound();
    }

    const expertName = `${expertProfile.firstName} ${expertProfile.lastName}`;
    // Use ProfilesTable.profilePicture (professional image), not cached UsersTable.imageUrl
    const expertImage = expertProfile.profilePicture || '/placeholder-avatar.jpg';

    return (
      <div className="flex min-h-screen items-center bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          {/* Success Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="font-serif text-3xl font-light text-gray-900 sm:text-4xl">
              Your reservation is confirmed!
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              You&apos;re all set. We&apos;ve sent you a confirmation email with all the details.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Expert Profile Card */}
            <div className="lg:col-span-1">
              <Card className="h-fit">
                <CardContent className="p-0">
                  <div>
                    <div className="relative aspect-28/38 rounded-t-xl">
                      <Image
                        src={expertImage}
                        alt={expertName || 'Expert'}
                        width={1200}
                        height={1200}
                        className="absolute inset-0 h-full w-full overflow-hidden rounded-t-xl object-cover"
                        loading="lazy"
                        sizes="(max-width: 767px) 90vw, (max-width: 1023px) 45vw, 320px"
                      />
                      {/* Top Expert Badge */}
                      {expertProfile?.isTopExpert && (
                        <div className="absolute bottom-4 left-4">
                          <span className="rounded-sm bg-white px-3 py-2 text-base font-medium text-eleva-neutral-900">
                            <span>{t('topExpertBadge')}</span>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="rounded-b-xl bg-white p-4 pb-6">
                      <h3 className="text-lg font-medium text-gray-900">{expertName}</h3>
                      {expertProfile?.headline && (
                        <p className="text-sm text-gray-500">{expertProfile.headline}</p>
                      )}
                      {expertProfile?.primaryCategory && (
                        <p className="mt-1 text-xs text-gray-400">
                          {expertProfile.primaryCategory.name}
                        </p>
                      )}
                    </div>
                  </div>

                  {expertProfile?.isTopExpert && (
                    <div className="mt-4 inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                      ⭐ Top Expert
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Booking Details */}
            <div className="lg:col-span-2">
              <Card className="bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="font-serif text-xl font-light">Booking Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Event Info */}
                  <div className="flex items-start space-x-3">
                    <User className="mt-0.5 h-5 w-5 text-gray-400" />
                    <div>
                      <h4 className="font-medium text-gray-900">{event.name}</h4>
                      <p className="mt-1 text-sm text-gray-500">
                        Duration: {event.durationInMinutes} minutes
                      </p>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="flex items-start space-x-3">
                    <Calendar className="mt-0.5 h-5 w-5 text-gray-400" />
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {formatDateTime(startTimeDate, displayTimezone)}
                      </h4>
                      <p className="text-sm text-gray-500">
                        <Clock className="mr-1 inline h-4 w-4" />
                        {displayTimezone.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  {event.price > 0 && (
                    <div className="flex items-start space-x-3">
                      <CreditCard className="mt-0.5 h-5 w-5 text-gray-400" />
                      <div>
                        <h4 className="font-medium text-gray-900">
                          €{(event.price / 100).toFixed(2)} EUR
                        </h4>
                        <p className="text-sm text-gray-500">Payment confirmed</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Next Steps */}
              <Card className="mt-6 bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="font-serif text-lg font-light">What&apos;s Next?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-eleva-primary text-xs font-medium text-white">
                        1
                      </div>
                      <p className="text-sm text-gray-700">
                        You&apos;ll receive a confirmation email with calendar invite and meeting
                        details
                      </p>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-eleva-primary text-xs font-medium text-white">
                        2
                      </div>
                      <p className="text-sm text-gray-700">
                        {expertName} will reach out if any preparation is needed
                      </p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-eleva-primary text-xs font-medium text-white">
                        3
                      </div>
                      <p className="text-sm text-gray-700">
                        Join your session at the scheduled time using the meeting link
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Support Footer */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">Need help? Contact our support team.</p>
          </div>
        </div>
      </div>
    );
  }

  // If paid event but no meeting found, check the session status
  if (event.price > 0 && session_id) {
    // **SECURITY: Validate session ID format before calling Stripe**
    if (typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
      console.error('Invalid session ID format:', session_id);
      return notFound();
    }

    const stripe = await getServerStripe();

    // IMPORTANT: Use ProfilesTable for expert display name (professional name)
    if (!expertProfile) {
      console.error(
        '[SuccessPage Calendar] No expert profile found for:',
        calendarUser.workosUserId,
      );
      return notFound();
    }

    const expertName = `${expertProfile.firstName} ${expertProfile.lastName}`;
    // Use ProfilesTable.profilePicture (professional image), not cached UsersTable.imageUrl
    const expertImage = expertProfile.profilePicture || '/placeholder-avatar.jpg';

    try {
      console.log('Checking session status:', {
        sessionId: session_id,
        startTime,
        eventSlug,
      });

      const session = await stripe.checkout.sessions.retrieve(session_id);

      console.log('Session status:', {
        sessionId: session_id,
        paymentStatus: session.payment_status,
        customerId: session.customer,
        paymentIntent: session.payment_intent,
      });

      if (session.payment_status === 'paid') {
        return (
          <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              {/* Processing Header */}
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                  <Clock className="h-10 w-10 animate-spin text-blue-600" />
                </div>
                <h1 className="font-serif text-3xl font-light text-gray-900 sm:text-4xl">
                  Payment Confirmed
                </h1>
                <p className="mt-2 text-lg text-gray-600">
                  We&apos;re finalizing your booking. This will only take a moment.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Expert Profile Card */}
                <div className="lg:col-span-1">
                  <Card className="h-fit">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-4">
                        <div className="relative h-16 w-16 shrink-0">
                          <Image
                            src={expertImage}
                            alt={expertName || 'Expert'}
                            fill
                            className="rounded-full object-cover"
                            sizes="64px"
                          />
                          {expertProfile?.isVerified && (
                            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-500">
                              <CheckCircle className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-lg font-medium text-gray-900">
                            {expertName}
                          </h3>
                          {expertProfile?.headline && (
                            <p className="truncate text-sm text-gray-500">
                              {expertProfile.headline}
                            </p>
                          )}
                          {expertProfile?.primaryCategory && (
                            <p className="mt-1 text-xs text-gray-400">
                              {expertProfile.primaryCategory.name}
                            </p>
                          )}
                        </div>
                      </div>

                      {expertProfile?.isTopExpert && (
                        <div className="mt-4 inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                          ⭐ Top Expert
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Processing Message */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="font-serif text-xl font-light">
                        Creating Your Booking
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-start space-x-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                        <p className="text-sm text-gray-700">Payment confirmed</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                        <p className="text-sm text-gray-700">Setting up your meeting...</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="h-6 w-6 rounded-full border-2 border-gray-200"></div>
                        <p className="text-sm text-gray-400">Sending confirmation email</p>
                      </div>

                      <div className="mt-6 rounded-lg bg-blue-50 p-4">
                        <p className="text-sm text-blue-800">
                          <strong>Please wait...</strong> This page will refresh automatically when
                          your booking is ready.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <meta httpEquiv="refresh" content="5" />
            </div>
          </div>
        );
      }

      if (session.payment_status === 'unpaid') {
        return (
          <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              {/* Processing Header */}
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
                  <Clock className="h-10 w-10 animate-pulse text-yellow-600" />
                </div>
                <h1 className="font-serif text-3xl font-light text-gray-900 sm:text-4xl">
                  Processing Payment
                </h1>
                <p className="mt-2 text-lg text-gray-600">
                  We&apos;re confirming your payment. Please wait a moment.
                </p>
              </div>

              <div className="mx-auto max-w-2xl">
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="space-y-4">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent"></div>
                      <p className="text-gray-700">
                        Your payment is being processed. This usually takes just a few seconds.
                      </p>
                      <p className="text-sm text-gray-500">
                        This page will automatically refresh when the payment is confirmed.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <meta httpEquiv="refresh" content="5" />
            </div>
          </div>
        );
      }

      // If payment failed or other status
      console.error('Unexpected payment status:', session.payment_status);
      redirect(`/${locale}/${username}/${eventSlug}/book?error=payment-failed`);
    } catch (error) {
      console.error('Error retrieving session:', error);
      redirect(`/${locale}/${username}/${eventSlug}/book?error=payment-error`);
    }
  }

  // If paid event but no meeting and no valid session, redirect to booking page
  if (event.price > 0) {
    redirect(`/${locale}/${username}/${eventSlug}/book?error=payment-incomplete`);
  }

  // If free event but no meeting, something went wrong
  redirect(`/${locale}/${username}/${eventSlug}/book?error=meeting-not-created`);
}
