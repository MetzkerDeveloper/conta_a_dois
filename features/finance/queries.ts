import 'server-only';
import { getDb } from '@/db';
import { requireHousehold } from '@/features/household/queries';
import { currentMonth } from './month';
import { monthSchema } from './schema';
import { getMonthlyFinance } from './service';

export type SearchParams = Record<string, string | string[] | undefined>;
export async function loadFinance(params: SearchParams) {
  const { user } = await requireHousehold();
  const selected = monthSchema.safeParse(params.mes);
  const data = await getMonthlyFinance(
    getDb(),
    user.id,
    selected.success ? selected.data : currentMonth(),
  );
  return { ...data, userId: user.id };
}
