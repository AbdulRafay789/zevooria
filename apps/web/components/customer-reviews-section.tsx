'use client';

import { useState } from 'react';
import { storageKeyToPublicUrl } from '../lib/catalog';
import type { PublicReview, PublicReviewsPage } from '../lib/api';
import { getBrowserApiBase } from '../lib/commerce-api';
import styles from '../app/page.module.css';

function stars(rating: number): string {
  return '★★★★★'.slice(0, Math.max(0, Math.min(5, Math.round(rating))));
}

function formatAverage(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '.0');
}

async function fetchPublicReviewsPage(
  offset: number,
  limit = 20,
): Promise<PublicReviewsPage | null> {
  try {
    const response = await fetch(
      `${getBrowserApiBase()}/reviews/public?limit=${limit}&offset=${offset}`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' },
    );
    if (!response.ok) {
      return null;
    }
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== 'object' ||
      !Array.isArray((data as PublicReviewsPage).items)
    ) {
      return null;
    }
    return data as PublicReviewsPage;
  } catch {
    return null;
  }
}

type CustomerReviewsSectionProps = {
  initial: PublicReviewsPage;
};

export function CustomerReviewsSection({
  initial,
}: CustomerReviewsSectionProps) {
  const [items, setItems] = useState<PublicReview[]>(initial.items);
  const [offset, setOffset] = useState(initial.offset + initial.items.length);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [total] = useState(initial.total);
  const [averageRating] = useState(initial.averageRating);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (total === 0 && items.length === 0) {
    return null;
  }

  const onLoadMore = async () => {
    if (loading || !hasMore) {
      return;
    }
    setLoading(true);
    setError(null);
    const page = await fetchPublicReviewsPage(offset, 20);
    if (!page) {
      setError('Unable to load more reviews.');
      setLoading(false);
      return;
    }
    setItems((prev) => [...prev, ...page.items]);
    setOffset(page.offset + page.items.length);
    setHasMore(page.hasMore);
    setLoading(false);
  };

  return (
    <section
      id="customer-notes"
      className={styles.notes}
      aria-labelledby="notes-heading"
    >
      <div className={styles.notesHead}>
        <p className={styles.sectionEyebrow}>Customer voices</p>
        <h2 id="notes-heading" className={styles.notesTitle}>
          Real reviews from real customers
        </h2>
        <p className={styles.notesSummary}>
          <span
            className={styles.notesAvg}
            aria-label={`${formatAverage(averageRating)} out of 5 average`}
          >
            {formatAverage(averageRating)}
            <span className={styles.notesAvgStars} aria-hidden>
              {stars(averageRating)}
            </span>
          </span>
          <span className={styles.notesCount}>
            {total.toLocaleString('en-PK')} review{total === 1 ? '' : 's'}
          </span>
        </p>
      </div>

      <ul className={styles.notesGrid}>
        {items.map((review, index) => (
          <li
            key={`${review.displayName}-${review.productName}-${index}`}
            className={styles.noteCard}
          >
            <div className={styles.noteTop}>
              {review.imageKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.noteMedia}
                  src={storageKeyToPublicUrl(review.imageKey)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className={styles.noteMediaPlaceholder} aria-hidden />
              )}
              <div className={styles.noteIdentity}>
                <p
                  className={styles.noteStars}
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {stars(review.rating)}
                </p>
                <p className={styles.noteMeta}>
                  {review.displayName}
                  <span className={styles.noteProduct}>
                    {' '}
                    · {review.productName}
                  </span>
                </p>
              </div>
            </div>
            <p className={styles.noteQuote}>&ldquo;{review.body}&rdquo;</p>
          </li>
        ))}
      </ul>

      {error ? <p className={styles.notesError}>{error}</p> : null}

      {hasMore ? (
        <div className={styles.notesActions}>
          <button
            type="button"
            className={styles.notesLoadMore}
            disabled={loading}
            onClick={() => {
              void onLoadMore();
            }}
          >
            {loading ? 'Loading…' : 'Load more reviews'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
