import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  categories,
  expenses,
  financialMonths,
  householdMembers,
  households,
  incomes,
  incomeDefaults,
  recurringExpenses,
  recurringOccurrences,
  settlements,
  user as users,
} from '@/db/schema';
import { requireUser } from '@/features/household/queries';

export async function GET() {
  const actor = await requireUser('/casal/ajustes');
  const db = getDb();
  const [profile] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      consentedAt: users.consentedAt,
      privacyVersion: users.privacyVersion,
    })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);
  const [membership] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, actor.id))
    .limit(1);

  const shared = membership
    ? await (async () => {
        const householdId = membership.householdId;
        const [
          household,
          members,
          incomeRows,
          incomeDefaultRows,
          expenseRows,
          categoryRows,
          recurringRows,
          occurrenceRows,
          closingRows,
          settlementRows,
        ] = await Promise.all([
          db.select().from(households).where(eq(households.id, householdId)),
          db
            .select()
            .from(householdMembers)
            .where(eq(householdMembers.householdId, householdId)),
          db.select().from(incomes).where(eq(incomes.householdId, householdId)),
          db
            .select()
            .from(incomeDefaults)
            .where(eq(incomeDefaults.householdId, householdId)),
          db
            .select()
            .from(expenses)
            .where(eq(expenses.householdId, householdId)),
          db
            .select()
            .from(categories)
            .where(eq(categories.householdId, householdId)),
          db
            .select()
            .from(recurringExpenses)
            .where(eq(recurringExpenses.householdId, householdId)),
          db
            .select()
            .from(recurringOccurrences)
            .where(eq(recurringOccurrences.householdId, householdId)),
          db
            .select()
            .from(financialMonths)
            .where(eq(financialMonths.householdId, householdId)),
          db
            .select()
            .from(settlements)
            .where(eq(settlements.householdId, householdId)),
        ]);
        return {
          household: household[0] ?? null,
          members,
          incomes: incomeRows,
          incomeDefaults: incomeDefaultRows,
          expenses: expenseRows,
          categories: categoryRows,
          recurringExpenses: recurringRows,
          recurringOccurrences: occurrenceRows,
          monthClosings: closingRows,
          settlements: settlementRows,
        };
      })()
    : null;

  const payload = {
    format: 'contas-a-dois-export-v1',
    exportedAt: new Date().toISOString(),
    notice:
      'Os dados financeiros do casal são compartilhados entre os membros.',
    account: profile ?? null,
    household: shared,
  };
  const body = JSON.stringify(payload, null, 2);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="contas-a-dois-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
