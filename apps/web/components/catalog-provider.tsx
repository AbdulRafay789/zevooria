'use client';

import { createContext, useContext } from 'react';
import type { Product } from '../lib/types';

const CatalogContext = createContext<Product[]>([]);

export function CatalogProvider({
  products,
  children,
}: {
  products: Product[];
  children: React.ReactNode;
}) {
  return (
    <CatalogContext.Provider value={products}>{children}</CatalogContext.Provider>
  );
}

export function useCatalogProducts(): Product[] {
  return useContext(CatalogContext);
}
