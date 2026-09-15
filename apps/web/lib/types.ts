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
  currency: string;
  status: string;
  media: ProductMedia[];
};
