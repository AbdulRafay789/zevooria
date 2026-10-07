'use client';

import { useEffect } from 'react';
import { recordProductView } from '../lib/recently-viewed';

type RecordProductViewProps = {
  slug: string;
};

export function RecordProductView({ slug }: RecordProductViewProps) {
  useEffect(() => {
    recordProductView(slug);
  }, [slug]);

  return null;
}
