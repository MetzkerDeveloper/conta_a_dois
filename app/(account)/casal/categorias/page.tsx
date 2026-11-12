import { loadSettings, type SearchParams } from '@/features/finance/queries';
import { CategoryManager } from '@/features/finance/components/category-manager';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await loadSettings(await searchParams);
  return (
    <>
      <section className="panel account-card">
        <h2>Categorias</h2>
        <CategoryManager categories={data.categories} />
      </section>
      
    </>
  );
}
