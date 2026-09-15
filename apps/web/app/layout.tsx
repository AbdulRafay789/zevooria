import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zevooria',
  description: 'Zevooria perfumes storefront',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
