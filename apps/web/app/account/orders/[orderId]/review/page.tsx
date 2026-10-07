'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AccountShell } from '../../../account-shell';
import { storageKeyToPublicUrl } from '../../../../../lib/catalog';
import {
  CommerceApiError,
  fetchReviewProducts,
  submitReview,
  type ReviewableProduct,
} from '../../../../../lib/commerce-api';
import styles from '../../../account.module.css';

export default function OrderReviewPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const [products, setProducts] = useState<ReviewableProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.orderId) {
      return;
    }
    let cancelled = false;
    fetchReviewProducts(params.orderId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setProducts(result.products);
        const first = result.products.find((product) => !product.alreadyReviewed);
        setSelectedProductId(first?.productId ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof CommerceApiError
              ? err.message
              : 'Unable to load reviewable products.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.orderId]);

  const eligible = useMemo(
    () => (products ?? []).filter((product) => !product.alreadyReviewed),
    [products],
  );

  const selected = eligible.find(
    (product) => product.productId === selectedProductId,
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || !params.orderId || !selectedProductId) {
      return;
    }
    if (rating < 1 || rating > 5) {
      setFieldError('Select a rating from 1 to 5.');
      return;
    }
    if (body.trim().length < 10) {
      setFieldError('Review must be at least 10 characters.');
      return;
    }
    setFieldError(null);
    setPending(true);
    try {
      await submitReview({
        orderId: params.orderId,
        productId: selectedProductId,
        rating,
        body: body.trim(),
      });
      setSuccess(true);
      setProducts((current) =>
        (current ?? []).map((product) =>
          product.productId === selectedProductId
            ? { ...product, alreadyReviewed: true }
            : product,
        ),
      );
    } catch (err: unknown) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to submit review.',
      );
    } finally {
      setPending(false);
    }
  };

  if (success) {
    return (
      <AccountShell title="Review submitted" eyebrow="Account">
        <p className={styles.success}>
          Thank you — your review has been saved.
        </p>
        <div className={styles.actions}>
          <Link
            href={`/account/orders/${params.orderId}`}
            className={styles.primaryBtn}
          >
            Back to order
          </Link>
          <Link href="/collection" className={styles.ghostBtn}>
            Continue shopping
          </Link>
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell
      title="Write a review"
      lede="Share your experience with a fragrance from this order."
    >
      {error ? <p className={styles.error}>{error}</p> : null}

      {products && eligible.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.lede}>
            There are no products left to review on this order.
          </p>
          <Link
            href={`/account/orders/${params.orderId}`}
            className={styles.ghostBtn}
          >
            Back to order
          </Link>
        </div>
      ) : null}

      {eligible.length > 0 ? (
        <div className={styles.reviewBlock}>
          {eligible.map((product) => (
            <button
              key={product.productId}
              type="button"
              className={styles.productRow}
              style={{
                width: '100%',
                textAlign: 'left',
                border:
                  selectedProductId === product.productId
                    ? '1px solid var(--ink)'
                    : undefined,
                padding: '0.85rem',
                background: 'transparent',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedProductId(product.productId)}
            >
              {product.imageKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.productImage}
                  src={storageKeyToPublicUrl(product.imageKey)}
                  alt=""
                />
              ) : (
                <span className={styles.thumbPlaceholder} />
              )}
              <div className={styles.productMeta}>
                <p className={styles.productName}>{product.productName}</p>
                <p className={styles.productDetail}>Select to review</p>
              </div>
            </button>
          ))}

          {selected ? (
            <form className={styles.form} onSubmit={onSubmit} noValidate>
              <div className={styles.field}>
                <span>Rating</span>
                <div className={styles.stars} role="group" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.starBtn} ${
                        rating >= value ? styles.starBtnActive : ''
                      }`}
                      aria-label={`${value} star${value === 1 ? '' : 's'}`}
                      aria-pressed={rating === value}
                      onClick={() => setRating(value)}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <label className={styles.field}>
                <span>Write your review</span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={2000}
                  aria-invalid={Boolean(fieldError)}
                />
              </label>
              {fieldError ? (
                <p className={styles.fieldError}>{fieldError}</p>
              ) : null}
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={pending}
              >
                {pending ? 'Submitting…' : 'Submit review'}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {!products && !error ? (
        <p className={styles.lede}>Loading…</p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => router.push(`/account/orders/${params.orderId}`)}
        >
          Back to order
        </button>
      </div>
    </AccountShell>
  );
}
