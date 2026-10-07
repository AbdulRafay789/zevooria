'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './hero-video.module.css';

const VIDEO_SRC = '/assets/video/making-video.mp4';

/** Native source is portrait (~478×850). Keep display modest. */
const MAX_DISPLAY_WIDTH = 300;
const MAX_DISPLAY_HEIGHT = 460;

type HeroVideoProps = {
  brand: React.ReactNode;
  children: React.ReactNode;
};

export function HeroVideo({ brand, children }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [failed, setFailed] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    null,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion || failed) {
      return;
    }
    video.muted = true;
    const play = video.play();
    if (play && typeof play.catch === 'function') {
      play.catch(() => setFailed(true));
    }
  }, [reducedMotion, failed]);

  const showVideo = !reducedMotion && !failed;

  const frameStyle =
    natural != null
      ? {
          aspectRatio: `${natural.w} / ${natural.h}`,
          maxWidth: `min(100%, ${Math.min(natural.w, MAX_DISPLAY_WIDTH)}px)`,
          maxHeight: `min(48vh, ${Math.min(natural.h, MAX_DISPLAY_HEIGHT)}px)`,
        }
      : undefined;

  return (
    <section className={styles.hero} aria-label="Zevooria campaign">
      <div className={styles.stage}>
        <div className={`${styles.brand} ${styles.enterBrand}`}>{brand}</div>
        <div
          className={`${styles.frame} ${styles.enterFrame}`}
          style={frameStyle}
          aria-hidden
        >
          {showVideo ? (
            <video
              ref={videoRef}
              className={styles.video}
              src={VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedMetadata={(event) => {
                const el = event.currentTarget;
                if (el.videoWidth > 0 && el.videoHeight > 0) {
                  setNatural({ w: el.videoWidth, h: el.videoHeight });
                }
              }}
              onError={() => setFailed(true)}
            />
          ) : (
            <div className={styles.fallback} />
          )}
        </div>
        <div className={`${styles.content} ${styles.enterContent}`}>
          {children}
        </div>
      </div>
    </section>
  );
}
