import type { ReactNode } from 'react';
import styles from './content-page.module.css';

type ContentPageProps = {
  eyebrow: string;
  title: string;
  lede?: string;
  children: ReactNode;
};

export function ContentPage({
  eyebrow,
  title,
  lede,
  children,
}: ContentPageProps) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          {lede ? <p className={styles.lede}>{lede}</p> : null}
        </header>
        <div className={styles.body}>{children}</div>
      </main>
    </div>
  );
}
