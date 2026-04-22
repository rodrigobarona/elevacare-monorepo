import { Suspense } from 'react';

import { HeaderContent } from './HeaderContent';

export default function Header() {
  return (
    <Suspense fallback={<div className="h-16 lg:h-20" />}>
      <HeaderContent />
    </Suspense>
  );
}
