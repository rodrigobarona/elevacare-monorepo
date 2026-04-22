import { ProfileAccessControl } from '@/components/auth/ProfileAccessControl';
import { Suspense } from 'react';

import PaymentProcessingClient from './PaymentProcessingClient';

interface PageProps {
  params: Promise<{
    username: string;
    eventSlug: string;
    locale: string;
  }>;
  searchParams: Promise<{
    startTime: string;
  }>;
}

export default async function PaymentProcessingPage(props: PageProps) {
  const params = await props.params;
  const { username, eventSlug } = params;

  return (
    <ProfileAccessControl
      username={username}
      context="PaymentProcessingPage"
      additionalPath={eventSlug}
    >
      <Suspense fallback={<div>Loading payment status...</div>}>
        <PaymentProcessingClient params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </ProfileAccessControl>
  );
}
