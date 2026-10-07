'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './reveal.module.css';

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger offset in ms (applied as CSS custom property). */
  delayMs?: number;
  /** Once visible, stay revealed (default true). */
  once?: boolean;
};

export function Reveal({
  children,
  className,
  delayMs = 0,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) {
              observer.disconnect();
            }
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [once, reducedMotion]);

  return (
    <div
      ref={ref}
      className={[
        styles.reveal,
        visible || reducedMotion ? styles.visible : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ['--reveal-delay' as string]: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
