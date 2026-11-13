import {
  loadFinancialHistory,
  type SearchParams,
} from '@/features/finance/queries';
import { HistoryDashboard } from '@/features/finance/components/history-dashboard';

export default async function EvolutionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await loadFinancialHistory(await searchParams);
  return <HistoryDashboard key={`${data.month}:${data.range}`} data={data} />;
}
