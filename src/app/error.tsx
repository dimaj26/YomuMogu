'use client';

import React, { useEffect } from 'react';
import { ErrorFallback } from '@/components/ErrorFallback';
import { logger } from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Next.js Global Page Error occurred:', error);
  }, [error]);

  return <ErrorFallback error={error} reset={reset} />;
}
