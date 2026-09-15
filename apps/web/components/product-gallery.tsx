'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { ProductMedia } from '../lib/types';
import { storageKeyToPublicUrl } from '../lib/catalog';
import {
  canGoNext,
  canGoPrevious,
  getActiveImageIndex,
  reduceLightboxState,
  type LightboxState,
} from '../lib/product-gallery-logic';
import styles from './product-gallery.module.css';

type ProductGalleryProps = {
  productName: string;
  images: ProductMedia[];
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ProductGallery({ productName, images }: ProductGalleryProps) {
  const initialKey = images[0]?.storageKey ?? null;
  const [activeKey, setActiveKey] = useState<string | null>(initialKey);
  const [lightbox, setLightbox] = useState<LightboxState>({
    open: false,
    index: 0,
  });
  const [portalReady, setPortalReady] = useState(false);

  const openTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lightboxRef = useRef(lightbox);
  const titleId = useId();

  lightboxRef.current = lightbox;

  const activeIndex = useMemo(
    () => getActiveImageIndex(images, activeKey),
    [activeKey, images],
  );
  const active = activeIndex >= 0 ? images[activeIndex] : undefined;
  const lightboxImage =
    lightbox.open && lightbox.index >= 0 ? images[lightbox.index] : undefined;

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const dispatchLightbox = useCallback(
    (command: Parameters<typeof reduceLightboxState>[1]) => {
      setLightbox((current) => {
        const next = reduceLightboxState(current, command, images.length);
        if (
          next.open &&
          (next.index !== current.index || !current.open) &&
          images[next.index]
        ) {
          setActiveKey(images[next.index].storageKey);
        }
        return next;
      });
    },
    [images],
  );

  const openLightbox = useCallback(() => {
    if (images.length === 0) {
      return;
    }
    restoreFocusRef.current =
      (document.activeElement as HTMLElement | null) ?? openTriggerRef.current;
    dispatchLightbox({ type: 'open', index: Math.max(activeIndex, 0) });
  }, [activeIndex, dispatchLightbox, images.length]);

  const closeLightbox = useCallback(() => {
    dispatchLightbox({ type: 'close' });
  }, [dispatchLightbox]);

  useEffect(() => {
    if (!lightbox.open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      const current = lightboxRef.current;

      if (event.key === 'Tab' && dialog) {
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => !(el as HTMLButtonElement).disabled);

        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeEl = document.activeElement as HTMLElement | null;

        if (event.shiftKey && activeEl === first) {
          event.preventDefault();
          last.focus();
          return;
        }
        if (!event.shiftKey && activeEl === last) {
          event.preventDefault();
          first.focus();
          return;
        }
        return;
      }

      const nextState = reduceLightboxState(
        current,
        { type: 'key', key: event.key },
        images.length,
      );
      if (
        nextState.open === current.open &&
        nextState.index === current.index
      ) {
        return;
      }
      event.preventDefault();
      dispatchLightbox({ type: 'key', key: event.key });
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [dispatchLightbox, images.length, lightbox.open]);

  useEffect(() => {
    if (lightbox.open) {
      return;
    }
    const target = restoreFocusRef.current;
    if (target) {
      target.focus();
      restoreFocusRef.current = null;
    }
  }, [lightbox.open]);

  if (images.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.stage}>
          <div className={styles.placeholder}>Imagery forthcoming</div>
        </div>
      </div>
    );
  }

  if (!active) {
    return null;
  }

  const showThumbs = images.length > 1;
  const showNav = images.length > 1;
  const atStart = !canGoPrevious(lightbox.index);
  const atEnd = !canGoNext(lightbox.index, images.length);

  return (
    <div className={styles.root}>
      <div className={styles.stage}>
        <button
          ref={openTriggerRef}
          type="button"
          className={styles.stageOpen}
          onClick={openLightbox}
          aria-label={`View ${productName} larger`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={active.storageKey}
            className={styles.image}
            src={storageKeyToPublicUrl(active.storageKey)}
            alt=""
            decoding="async"
          />
          <span className={styles.stageHint} aria-hidden>
            View larger
          </span>
        </button>
      </div>

      {showThumbs ? (
        <ul className={styles.thumbs} aria-label={`${productName} image gallery`}>
          {images.map((image, index) => {
            const selected = image.storageKey === active.storageKey;
            return (
              <li key={image.id}>
                <button
                  type="button"
                  className={selected ? styles.thumbActive : styles.thumb}
                  aria-label={
                    image.altText ?? `${productName} view ${index + 1}`
                  }
                  aria-pressed={selected}
                  onClick={() => setActiveKey(image.storageKey)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={storageKeyToPublicUrl(image.storageKey)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {portalReady && lightbox.open && lightboxImage
        ? createPortal(
            <div
              className={styles.lightbox}
              role="presentation"
              onClick={closeLightbox}
            >
              <div
                ref={dialogRef}
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
              >
                <p id={titleId} className={styles.dialogTitle}>
                  {productName}
                </p>

                <button
                  ref={closeButtonRef}
                  type="button"
                  className={styles.close}
                  aria-label="Close image viewer"
                  onClick={closeLightbox}
                >
                  <span aria-hidden>×</span>
                </button>

                <div className={styles.lightboxFrame}>
                  {showNav ? (
                    <button
                      type="button"
                      className={styles.navPrev}
                      aria-label="Previous image"
                      disabled={atStart}
                      onClick={() => dispatchLightbox({ type: 'prev' })}
                    >
                      <span aria-hidden>‹</span>
                    </button>
                  ) : null}

                  <div className={styles.lightboxStage}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={lightboxImage.storageKey}
                      className={styles.lightboxImage}
                      src={storageKeyToPublicUrl(lightboxImage.storageKey)}
                      alt={lightboxImage.altText ?? productName}
                      decoding="async"
                    />
                  </div>

                  {showNav ? (
                    <button
                      type="button"
                      className={styles.navNext}
                      aria-label="Next image"
                      disabled={atEnd}
                      onClick={() => dispatchLightbox({ type: 'next' })}
                    >
                      <span aria-hidden>›</span>
                    </button>
                  ) : null}
                </div>

                <p className={styles.counter} aria-live="polite">
                  {lightbox.index + 1} / {images.length}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
