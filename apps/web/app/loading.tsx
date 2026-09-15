import { CatalogLoading } from '../components/catalog-state';

export default function Loading() {
  return (
    <main style={{ width: 'min(1120px, calc(100% - 2rem))', margin: '2.75rem auto' }}>
      <CatalogLoading />
    </main>
  );
}
