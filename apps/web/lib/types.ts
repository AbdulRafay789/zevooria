export type ProductMedia = {
  id: string;
  type: string;
  storageKey: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  /** Display-only list price; show strikethrough when greater than price. */
  compareAtPrice?: string | null;
  currency: string;
  status: string;
  sortOrder?: number;
  availableQuantity?: number;
  media: ProductMedia[];
};
