'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useAuth } from './auth-provider';
import { useCart } from './cart-provider';
import { useCatalogProducts } from './catalog-provider';
import { SiteSearch } from './site-search';
import styles from './site-header.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

type MenuPanelId = 'root' | 'shop' | 'collections' | 'services' | 'about';

const PANEL_TITLES: Record<MenuPanelId, string> = {
  root: 'Menu',
  shop: 'Shop',
  collections: 'Collections',
  services: 'Services',
  about: 'About',
};

export function SiteHeader() {
  const pathname = usePathname();
  const products = useCatalogProducts();
  const { count } = useCart();
  const { user, ready, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPanel, setMenuPanel] = useState<MenuPanelId>('root');
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const accountMenuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const isHome = pathname === '/';
  const overlay = isHome && !scrolled && !menuOpen && !searchOpen;
  const onAccount =
    pathname === '/account' ||
    pathname.startsWith('/account/') ||
    pathname === '/login' ||
    pathname === '/register';
  const onBag =
    pathname === '/cart' ||
    pathname === '/checkout' ||
    pathname.startsWith('/order-confirmation');

  function linkActive(
    href: string,
    mode: 'exact' | 'prefix' = 'prefix',
  ): boolean {
    if (href.includes('?')) {
      return false;
    }
    if (href === '/' || mode === 'exact') {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function menuLinkClass(
    href: string,
    mode: 'exact' | 'prefix' = 'prefix',
  ): string {
    return linkActive(href, mode)
      ? `${styles.menuLink} ${styles.menuLinkActive}`
      : styles.menuLink;
  }

  function iconClass(active: boolean): string {
    return active ? `${styles.iconBtn} ${styles.iconBtnActive}` : styles.iconBtn;
  }

  function sectionActive(id: MenuPanelId): boolean {
    if (id === 'shop' || id === 'collections') {
      return pathname === '/collection' || pathname.startsWith('/products/');
    }
    if (id === 'services') {
      return (
        pathname === '/shipping' ||
        pathname === '/returns' ||
        pathname === '/faqs'
      );
    }
    if (id === 'about') {
      return (
        pathname === '/our-story' ||
        pathname === '/who-we-are' ||
        pathname === '/what-we-do' ||
        pathname === '/privacy-policy'
      );
    }
    return false;
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuPanel('root');
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    restoreRef.current = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const syncFocus = () => {
      const panel = menuRef.current;
      const focusables = panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        : [];
      focusables[0]?.focus();
    };
    const timer = window.setTimeout(syncFocus, 30);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (menuPanel !== 'root') {
          setMenuPanel('root');
          return;
        }
        setMenuOpen(false);
        return;
      }
      const panel = menuRef.current;
      const focusables = panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        : [];
      if (event.key !== 'Tab' || focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const menuButton = menuButtonRef.current;
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      (restoreRef.current ?? menuButton)?.focus?.();
    };
  }, [menuOpen, menuPanel]);

  useEffect(() => {
    closeMenu();
    setSearchOpen(false);
    setAccountOpen(false);
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!accountOpen) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setAccountOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  const openMenu = () => {
    setMenuPanel('root');
    setMenuOpen(true);
    setAccountOpen(false);
  };

  const onLogout = async () => {
    setAccountOpen(false);
    closeMenu();
    await logout();
    window.location.assign('/login');
  };

  return (
    <>
      <header className={overlay ? styles.headerOverlay : styles.headerSolid}>
        <div className={styles.bar}>
          <div className={styles.navLeft}>
            <button
              ref={menuButtonRef}
              type="button"
              className={styles.menuBtn}
              aria-expanded={menuOpen}
              aria-controls={panelId}
              onClick={() => (menuOpen ? closeMenu() : openMenu())}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>

          <Link href="/" className={styles.brand} onClick={closeMenu}>
            <Image
              src="/brand/logo.png"
              alt="Zevooria"
              width={220}
              height={56}
              className={styles.brandLogo}
              priority
            />
          </Link>

          <div className={styles.navRight}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => {
                closeMenu();
                setSearchOpen(true);
              }}
            >
              Search
            </button>
            {ready && user ? (
              <div className={`${styles.accountWrap} ${styles.desktopOnly}`} ref={accountRef}>
                <button
                  type="button"
                  className={iconClass(onAccount)}
                  aria-expanded={accountOpen}
                  aria-controls={accountMenuId}
                  aria-current={onAccount ? 'page' : undefined}
                  onClick={() => {
                    closeMenu();
                    setAccountOpen((value) => !value);
                  }}
                >
                  Account
                </button>
                {accountOpen ? (
                  <div id={accountMenuId} className={styles.accountMenu} role="menu">
                    <Link
                      href="/account"
                      className={
                        linkActive('/account', 'exact')
                          ? `${styles.accountLink} ${styles.accountLinkActive}`
                          : styles.accountLink
                      }
                      role="menuitem"
                      aria-current={pathname === '/account' ? 'page' : undefined}
                      onClick={() => setAccountOpen(false)}
                    >
                      Account
                    </Link>
                    <Link
                      href="/account/orders"
                      className={
                        linkActive('/account/orders')
                          ? `${styles.accountLink} ${styles.accountLinkActive}`
                          : styles.accountLink
                      }
                      role="menuitem"
                      aria-current={
                        linkActive('/account/orders') ? 'page' : undefined
                      }
                      onClick={() => setAccountOpen(false)}
                    >
                      My orders
                    </Link>
                    <button
                      type="button"
                      className={styles.accountLink}
                      role="menuitem"
                      onClick={() => {
                        void onLogout();
                      }}
                    >
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link
                href="/login"
                className={`${iconClass(onAccount)} ${styles.desktopOnly}`}
                aria-current={pathname === '/login' ? 'page' : undefined}
                onClick={closeMenu}
              >
                Account
              </Link>
            )}
            <Link
              href={ready && user ? '/cart' : '/login?next=/cart'}
              className={iconClass(onBag)}
              onClick={closeMenu}
              aria-current={onBag ? 'page' : undefined}
              aria-label={
                ready && user && count > 0
                  ? `Bag, ${count} items`
                  : 'Bag'
              }
            >
              {ready && user && count > 0 ? `Bag (${count})` : 'Bag'}
            </Link>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className={styles.menuRoot} role="presentation">
          <button
            type="button"
            className={styles.menuBackdrop}
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div
            ref={menuRef}
            id={panelId}
            className={styles.menuPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className={styles.menuTop}>
              {menuPanel === 'root' ? (
                <p id={titleId} className={styles.menuTitle}>
                  Menu
                </p>
              ) : (
                <button
                  type="button"
                  className={styles.menuBack}
                  onClick={() => setMenuPanel('root')}
                >
                  Back
                </button>
              )}
              <button
                type="button"
                className={styles.menuClose}
                onClick={closeMenu}
              >
                Close
              </button>
            </div>

            {menuPanel !== 'root' ? (
              <h2 id={titleId} className={styles.panelHeading}>
                {PANEL_TITLES[menuPanel]}
              </h2>
            ) : null}

            <nav className={styles.menuNav} aria-label="Site">
              {menuPanel === 'root' ? (
                <>
                  <ul className={styles.rootList}>
                    {(
                      [
                        ['shop', 'Shop'],
                        ['collections', 'Collections'],
                        ['services', 'Services'],
                        ['about', 'About'],
                      ] as const
                    ).map(([id, label]) => (
                      <li key={id}>
                        <button
                          type="button"
                          className={
                            sectionActive(id)
                              ? `${styles.rootItem} ${styles.rootItemActive}`
                              : styles.rootItem
                          }
                          aria-current={sectionActive(id) ? 'true' : undefined}
                          onClick={() => setMenuPanel(id)}
                        >
                          <span>{label}</span>
                          <span aria-hidden className={styles.chevron}>
                            →
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className={styles.menuGroup}>
                    <p className={styles.menuNote}>Account</p>
                    {ready && user ? (
                      <>
                        <Link
                          href="/account"
                          className={menuLinkClass('/account', 'exact')}
                          aria-current={
                            pathname === '/account' ? 'page' : undefined
                          }
                          onClick={closeMenu}
                        >
                          Account
                        </Link>
                        <Link
                          href="/account/orders"
                          className={menuLinkClass('/account/orders')}
                          aria-current={
                            linkActive('/account/orders') ? 'page' : undefined
                          }
                          onClick={closeMenu}
                        >
                          My orders
                        </Link>
                        <button
                          type="button"
                          className={styles.menuLinkBtn}
                          onClick={() => {
                            void onLogout();
                          }}
                        >
                          Log out
                        </button>
                      </>
                    ) : (
                      <Link
                        href="/login"
                        className={menuLinkClass('/login')}
                        aria-current={
                          pathname === '/login' ? 'page' : undefined
                        }
                        onClick={closeMenu}
                      >
                        Sign in
                      </Link>
                    )}
                  </div>
                </>
              ) : null}

              {menuPanel === 'shop' ? (
                <div className={styles.menuGroup}>
                  <Link
                    href="/collection"
                    className={menuLinkClass('/collection')}
                    aria-current={
                      pathname === '/collection' ? 'page' : undefined
                    }
                    onClick={closeMenu}
                  >
                    All fragrances
                  </Link>
                  <Link
                    href="/collection?category=signature"
                    className={styles.menuLink}
                    onClick={closeMenu}
                  >
                    Signature
                  </Link>
                  <Link
                    href="/collection?category=fragrance"
                    className={styles.menuLink}
                    onClick={closeMenu}
                  >
                    Fragrances
                  </Link>
                  <Link
                    href="/collection?category=tester"
                    className={styles.menuLink}
                    onClick={closeMenu}
                  >
                    Testers
                  </Link>
                </div>
              ) : null}

              {menuPanel === 'collections' ? (
                <div className={styles.menuGroup}>
                  <Link
                    href="/collection?category=signature"
                    className={styles.menuLink}
                    onClick={closeMenu}
                  >
                    Signature collection
                  </Link>
                  <Link
                    href="/collection"
                    className={menuLinkClass('/collection')}
                    aria-current={
                      pathname === '/collection' ? 'page' : undefined
                    }
                    onClick={closeMenu}
                  >
                    All fragrances
                  </Link>
                  <Link
                    href="/collection?category=tester"
                    className={styles.menuLink}
                    onClick={closeMenu}
                  >
                    Discovery / tester
                  </Link>
                </div>
              ) : null}

              {menuPanel === 'services' ? (
                <div className={styles.menuGroup}>
                  <Link
                    href="/shipping"
                    className={menuLinkClass('/shipping')}
                    aria-current={
                      pathname === '/shipping' ? 'page' : undefined
                    }
                    onClick={closeMenu}
                  >
                    Shipping & delivery
                  </Link>
                  <Link
                    href="/returns"
                    className={menuLinkClass('/returns')}
                    aria-current={
                      pathname === '/returns' ? 'page' : undefined
                    }
                    onClick={closeMenu}
                  >
                    Returns & exchanges
                  </Link>
                  <Link
                    href="/faqs"
                    className={menuLinkClass('/faqs')}
                    aria-current={pathname === '/faqs' ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    Care / FAQ
                  </Link>
                  <a
                    href="mailto:support@zevooria.com"
                    className={styles.menuLink}
                    onClick={closeMenu}
                  >
                    Contact
                  </a>
                </div>
              ) : null}

              {menuPanel === 'about' ? (
                <div className={styles.menuGroup}>
                  <Link
                    href="/our-story"
                    className={menuLinkClass('/our-story')}
                    aria-current={
                      pathname === '/our-story' ? 'page' : undefined
                    }
                    onClick={closeMenu}
                  >
                    Our story
                  </Link>
                  <Link
                    href="/who-we-are"
                    className={menuLinkClass('/who-we-are')}
                    aria-current={
                      pathname === '/who-we-are' ? 'page' : undefined
                    }
                    onClick={closeMenu}
                  >
                    Who we are
                  </Link>
                  <Link
                    href="/what-we-do"
                    className={menuLinkClass('/what-we-do')}
                    aria-current={
                      pathname === '/what-we-do' ? 'page' : undefined
                    }
                    onClick={closeMenu}
                  >
                    What we do
                  </Link>
                  <Link
                    href="/privacy-policy"
                    className={menuLinkClass('/privacy-policy')}
                    aria-current={
                      pathname === '/privacy-policy' ? 'page' : undefined
                    }
                    onClick={closeMenu}
                  >
                    Privacy policy
                  </Link>
                </div>
              ) : null}
            </nav>
          </div>
        </div>
      ) : null}

      <SiteSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
      />
    </>
  );
}
