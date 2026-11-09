import { Suspense } from 'react';

import AvPageClient from '@/components/AvPageClient';

export default function AvPage() {
  return (
    <Suspense>
      <AvPageClient />
    </Suspense>
  );
}
