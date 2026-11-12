import {
  and,
  asc,
  count,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '@/db';
import {
  categories,
  expenses,
  financialMonths,
  householdMembers,
  recurringExpenses,
} from '@/db/schema';
import { actorHousehold, FinanceError, readEffectiveIncomes } from './service';
import { monthSchema } from './schema';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
const readOptions = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
} as const;
export const EXPENSE_PAGE_SIZE = 25;
export const expenseListSchema = z.object({
  category: z.uuid().or(z.literal('')).catch(''),
  status: z.enum(['', 'paid', 'pending']).catch(''),
  search: z.string().trim().max(120).catch(''),
  page: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).catch(1),
});

async function readContext(tx: Tx, userId: string) {
  const household = await actorHousehold(tx, userId, false);
  const members = await tx
    .select({
      userId: householdMembers.userId,
      displayName: householdMembers.displayName,
      slot: householdMembers.slot,
    })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, household.id))
    .orderBy(asc(householdMembers.slot));
  return { household, members };
}
async function readPeriod(tx: Tx, householdId: string, month: string) {
  const [period] = await tx
    .select({
      closedAt: financialMonths.closedAt,
      designatedPayerId: financialMonths.designatedPayerId,
    })
    .from(financialMonths)
    .where(
      and(
        eq(financialMonths.householdId, householdId),
        eq(financialMonths.month, `${month}-01`),
      ),
    );
  return period ?? null;
}
async function readCategories(tx: Tx, householdId: string) {
  return tx
    .select()
    .from(categories)
    .where(eq(categories.householdId, householdId))
    .orderBy(asc(categories.name));
}
function safeCents(value: string) {
  const cents = Number(BigInt(value));
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new FinanceError('O total do mês ultrapassa o limite suportado.');
  return cents;
}

export async function getFinanceSettings(
  db: Database,
  userId: string,
  rawMonth: string,
) {
  const month = monthSchema.parse(rawMonth);
  return db.transaction(async (tx) => {
    const context = await readContext(tx, userId);
    return {
      ...context,
      month,
      categories: await readCategories(tx, context.household.id),
    };
  }, readOptions);
}
export async function getFinanceIncomes(
  db: Database,
  userId: string,
  rawMonth: string,
) {
  const month = monthSchema.parse(rawMonth);
  return db.transaction(async (tx) => {
    const context = await readContext(tx, userId);
    const period = await readPeriod(tx, context.household.id, month);
    const records = await readEffectiveIncomes(tx, context.household.id, month);
    return {
      ...context,
      month,
      period,
      incomes: records,
    };
  }, readOptions);
}
export async function getExpenseEditor(
  db: Database,
  userId: string,
  rawMonth: string,
  id?: string,
) {
  const month = monthSchema.parse(rawMonth);
  return db.transaction(async (tx) => {
    const context = await readContext(tx, userId);
    const period = await readPeriod(tx, context.household.id, month);
    const categoryList = await readCategories(tx, context.household.id);
    const [expense] =
      id && z.uuid().safeParse(id).success
        ? await tx
            .select()
            .from(expenses)
            .where(
              and(
                eq(expenses.householdId, context.household.id),
                eq(expenses.month, `${month}-01`),
                eq(expenses.id, id),
              ),
            )
            .limit(1)
        : [];
    return {
      ...context,
      month,
      period,
      rule: period ?? context.household,
      categories: categoryList,
      expense: expense ?? null,
    };
  }, readOptions);
}
export async function getFinanceRecurring(
  db: Database,
  userId: string,
  rawMonth: string,
) {
  const month = monthSchema.parse(rawMonth);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, false);
    const categoryList = await readCategories(tx, household.id);
    const templates = await tx
      .select()
      .from(recurringExpenses)
      .where(eq(recurringExpenses.householdId, household.id))
      .orderBy(asc(recurringExpenses.description), asc(recurringExpenses.id));
    return { household, month, categories: categoryList, templates };
  }, readOptions);
}

export async function getExpenseList(
  db: Database,
  userId: string,
  rawMonth: string,
  rawFilters: unknown,
) {
  const month = monthSchema.parse(rawMonth);
  const filters = expenseListSchema.parse(rawFilters);
  return db.transaction(async (tx) => {
    const context = await readContext(tx, userId);
    // Projeta apenas o necessário do snapshot: não carrega seus lançamentos completos.
    const [periodRow] = await tx
      .select({
        closedAt: financialMonths.closedAt,
        snapshotCategories: sql<
          (typeof categories.$inferSelect)[] | null
        >`${financialMonths.snapshot}->'data'->'categories'`,
        snapshotTotalCents: sql<
          string | null
        >`${financialMonths.snapshot}->>'totalCents'`,
      })
      .from(financialMonths)
      .where(
        and(
          eq(financialMonths.householdId, context.household.id),
          eq(financialMonths.month, `${month}-01`),
        ),
      );
    const period = periodRow ?? null;
    const displayCategories =
      period?.closedAt && Array.isArray(period.snapshotCategories)
        ? period.snapshotCategories.map((category) => ({
            ...category,
            active: category.active ?? true,
          }))
        : await readCategories(tx, context.household.id);
    const searchPattern = `%${filters.search.replace(/[\\%_]/g, '\\$&')}%`;
    const matches =
      and(
        filters.category
          ? eq(expenses.categoryId, filters.category)
          : undefined,
        filters.status === 'paid'
          ? isNotNull(expenses.paidByUserId)
          : filters.status === 'pending'
            ? isNull(expenses.paidByUserId)
            : undefined,
        filters.search
          ? or(
              ilike(expenses.description, searchPattern),
              ilike(expenses.notes, searchPattern),
            )
          : undefined,
      ) ?? sql`true`;
    const inMonth = and(
      eq(expenses.householdId, context.household.id),
      eq(expenses.month, `${month}-01`),
    );
    const [stats] = await tx
      .select({
        totalCount: count(),
        totalCents: sql<string>`coalesce(sum(${expenses.amountCents}), 0)::text`,
        filteredCount: sql<number>`count(*) filter (where ${matches})`.mapWith(
          Number,
        ),
        filteredCents: sql<string>`coalesce(sum(${expenses.amountCents}) filter (where ${matches}), 0)::text`,
      })
      .from(expenses)
      .where(inMonth);
    const pageCount = Math.max(
      1,
      Math.ceil(stats!.filteredCount / EXPENSE_PAGE_SIZE),
    );
    const page = Math.min(filters.page, pageCount);
    const rows = await tx
      .select()
      .from(expenses)
      .where(and(inMonth, matches))
      .orderBy(asc(expenses.dueDate), asc(expenses.createdAt), asc(expenses.id))
      .limit(EXPENSE_PAGE_SIZE)
      .offset((page - 1) * EXPENSE_PAGE_SIZE);
    return {
      ...context,
      month,
      period,
      displayCategories,
      expenses: rows,
      filters: { ...filters, page },
      pageCount,
      pageSize: EXPENSE_PAGE_SIZE,
      totalCount: stats!.totalCount,
      filteredCount: stats!.filteredCount,
      totalCents:
        period?.closedAt && period.snapshotTotalCents !== null
          ? safeCents(period.snapshotTotalCents)
          : safeCents(stats!.totalCents),
      filteredCents: safeCents(stats!.filteredCents),
    };
  }, readOptions);
}
