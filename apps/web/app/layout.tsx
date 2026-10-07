import { Cormorant_Garamond, Manrope } from 'next/font/google';
import type { Metadata } from 'next';
import { AuthProvider } from '../components/auth-provider';
import { CartProvider } from '../components/cart-provider';
import { CatalogProvider } from '../components/catalog-provider';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { fetchProducts } from '../lib/api';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
});

const body = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'Zevooria — The Collection',
  description:
    'Zevooria perfumes — a dark, deliberate fragrance collection.',
  icons: {
    icon: [{ url: '/brand/mark.png', type: 'image/png' }],
    apple: [{ url: '/apple-icon.png', type: 'image/png' }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let products: Awaited<ReturnType<typeof fetchProducts>> = [];
  try {
    products = await fetchProducts();
  } catch {
    products = [];
  }

  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <CatalogProvider products={products}>
          <AuthProvider>
            <CartProvider>
              <SiteHeader />
              {children}
              <SiteFooter />
            </CartProvider>
          </AuthProvider>
        </CatalogProvider>
      </body>
    </html>
  );
}
