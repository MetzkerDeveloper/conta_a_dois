import 'server-only';
import { getFinancialHistory } from './history';
import { redirect } from 'next/navigation';
import { getDb, type Database } from '@/db';
import { requireUser } from '@/features/household/queries';
import { currentMonth } from './month';
import { monthSchema } from './schema';
import { getMonthlyFinance, MissingHouseholdError } from './service';
import {
  getFinanceSettings,
  getFinanceIncomes,
  getExpenseEditor,
  getFinanceRecurring,
  getExpenseList,
} from './read-models';

export type SearchParams = Record<string, string | string[] | undefined>;
async function loadForUser<T extends object>(
  params: SearchParams,
  read: (db: Database, userId: string, month: string) => Promise<T>,
) {
  const user = await requireUser();
  const selected = monthSchema.safeParse(params.mes);
  try {
    const data = await read(
      getDb(),
      user.id,
      selected.success ? selected.data : currentMonth(),
    );
    return { ...data, userId: user.id };
  } catch (error) {
    if (error instanceof MissingHouseholdError) redirect('/comecar');
    throw error;
  }
}
export function loadFinance(params: SearchParams) {
  return loadForUser(params, (db, userId, month) =>
    getMonthlyFinance(db, userId, month, 'dashboard'),
  );
}
export function loadSettlements(params: SearchParams) {
  return loadForUser(params, (db, userId, month) =>
    getMonthlyFinance(db, userId, month, 'settlements'),
  );
}
export function loadIncomes(params: SearchParams) {
  return loadForUser(params, getFinanceIncomes);
}
export function loadSettings(params: SearchParams) {
  return loadForUser(params, getFinanceSettings);
}
export function loadRecurring(params: SearchParams) {
  return loadForUser(params, getFinanceRecurring);
}
export function loadExpenseEditor(params: SearchParams, id?: string) {
  return loadForUser(params, (db, userId, month) =>
    getExpenseEditor(db, userId, month, id),
  );
}
export function loadExpenses(params: SearchParams) {
  return loadForUser(params, (db, userId, month) =>
    getExpenseList(db, userId, month, {
      category: params.categoria,
      status: params.status,
      search: params.busca,
      page: params.pagina,
    }),
  );
}

export function loadFinancialHistory(params: SearchParams) {
  return loadForUser(params, (db, userId, month) =>
    getFinancialHistory(db, userId, month, params.periodo),
  );
}
