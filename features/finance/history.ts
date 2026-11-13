import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '@/db';
import {
  categories,
  expenses,
  financialMonths,
  householdMembers,
  incomeDefaults,
  incomes,
} from '@/db/schema';
import { monthlyOutlook, safeCents } from '@/lib/settlement/financial-history';
import { actorHousehold } from './service';
import { monthSchema } from './schema';
import { shiftMonth } from './month';

const frozenIncomes = z.array(
  z.object({
    userId: z.string(),
    amountCents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }),
);
const frozenCategories = z.array(
  z.object({ id: z.string(), name: z.string() }),
);

export async function getFinancialHistory(
  db: Database,
  userId: string,
  rawMonth: string,
  rawRange: unknown,
) {
  const month = monthSchema.parse(rawMonth);
  const range = z.enum(['6', '12']).catch('12').parse(rawRange);
  const months = Array.from({ length: Number(range) }, (_, index) =>
    shiftMonth(month, index - Number(range) + 1),
  ).filter((value) => value >= '2000-01');
  const start = `${months[0]}-01`;
  const end = `${month}-01`;
  return db.transaction(
    async (tx) => {
      const household = await actorHousehold(tx, userId, false);
      const members = await tx
        .select({
          userId: householdMembers.userId,
          displayName: householdMembers.displayName,
        })
        .from(householdMembers)
        .where(eq(householdMembers.householdId, household.id))
        .orderBy(asc(householdMembers.slot));
      const periods = await tx
        .select({
          month: financialMonths.month,
          closedAt: financialMonths.closedAt,
          splitMode: financialMonths.splitMode,
          higherShareBps: financialMonths.higherShareBps,
          tiebreakUserId: financialMonths.tiebreakUserId,
          redistribute: financialMonths.redistributeByIncome,
          snapshotTotal: sql<
            number | null
          >`${financialMonths.snapshot}->'totalCents'`,
          snapshotShares: sql<Record<
            string,
            number
          > | null>`${financialMonths.snapshot}->'result'->'shares'`,
          snapshotIncomes: sql<unknown>`${financialMonths.snapshot}->'data'->'incomes'`,
          snapshotCategories: sql<unknown>`${financialMonths.snapshot}->'data'->'categories'`,
        })
        .from(financialMonths)
        .where(
          and(
            eq(financialMonths.householdId, household.id),
            gte(financialMonths.month, start),
            lte(financialMonths.month, end),
          ),
        );
      const records = await tx
        .select({
          month: incomes.month,
          userId: incomes.userId,
          amountCents: incomes.amountCents,
        })
        .from(incomes)
        .where(
          and(
            eq(incomes.householdId, household.id),
            gte(incomes.month, start),
            lte(incomes.month, end),
          ),
        );
      // Uma consulta para todas as vigências; nunca projeta a renda atual para antes de sua vigência.
      const defaults = await tx
        .select()
        .from(incomeDefaults)
        .where(
          and(
            eq(incomeDefaults.householdId, household.id),
            lte(incomeDefaults.effectiveMonth, end),
          ),
        )
        .orderBy(asc(incomeDefaults.effectiveMonth));
      const totals = await tx
        .select({
          month: expenses.month,
          categoryId: expenses.categoryId,
          total: sql<string>`sum(${expenses.amountCents})::text`,
          unpaid: sql<string>`coalesce(sum(${expenses.amountCents}) filter (where ${expenses.paidByUserId} is null), 0)::text`,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.householdId, household.id),
            gte(expenses.month, start),
            lte(expenses.month, end),
          ),
        )
        .groupBy(expenses.month, expenses.categoryId);
      const categoryList = await tx
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.householdId, household.id));
      const rows = months.map((value) => {
        const date = `${value}-01`;
        const period = periods.find((item) => item.month === date);
        const closed = !!period?.closedAt;
        const groups = totals.filter((item) => item.month === date);
        const expenseCents =
          closed && period.snapshotTotal !== null
            ? period.snapshotTotal
            : safeCents(
                groups.reduce((sum, item) => sum + BigInt(item.total), 0n),
              );
        const savedIncomes = closed
          ? frozenIncomes.parse(period.snapshotIncomes)
          : null;
        const effective = members.flatMap((member) => {
          const record = savedIncomes
            ? savedIncomes.find((item) => item.userId === member.userId)
            : (records.find(
                (item) => item.month === date && item.userId === member.userId,
              ) ??
              defaults.findLast(
                (item) =>
                  item.userId === member.userId && item.effectiveMonth <= date,
              ));
          return record
            ? [{ userId: member.userId, incomeCents: record.amountCents }]
            : [];
        });
        const rule = period ?? household;
        const outlook =
          effective.length === members.length
            ? monthlyOutlook({
                members: effective,
                rule: {
                  mode: rule.splitMode,
                  higherShareBps: rule.higherShareBps,
                  tiebreakUserId: rule.tiebreakUserId ?? undefined,
                },
                totalCents: expenseCents,
                redistribute: period?.redistribute ?? false,
                frozenShares: closed
                  ? (period.snapshotShares ?? undefined)
                  : undefined,
              })
            : null;
        // Meses sem competência iniciada ficam fora dos indicadores de poupança.
        const started =
          !!period ||
          groups.length > 0 ||
          records.some((item) => item.month === date);
        const names = closed
          ? frozenCategories.parse(period.snapshotCategories)
          : categoryList;
        return {
          month: value,
          closed,
          started,
          outlook,
          expenseCents,
          unpaidCents: safeCents(
            groups.reduce((sum, item) => sum + BigInt(item.unpaid), 0n),
          ),
          categories: groups.map((group) => ({
            id: group.categoryId,
            name:
              names.find((item) => item.id === group.categoryId)?.name ??
              'Categoria',
            amountCents: safeCents(BigInt(group.total)),
          })),
        };
      });
      return { household, members, month, range, rows };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
export type FinancialHistory = Awaited<ReturnType<typeof getFinancialHistory>>;
