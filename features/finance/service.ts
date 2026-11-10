import { and, asc, count, desc, eq, ne, lte, sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import type { Database } from '@/db';
import {
  categories,
  expenses,
  financialMonths,
  householdMembers,
  households,
  incomes,
  settlements,
  user,
  recurringExpenses,
  recurringOccurrences,
} from '@/db/schema';
import { suggestCapacity } from '@/lib/settlement/suggest-capacity';
import { calculate } from '@/lib/settlement/calculate';
import { applyTransfers } from '@/lib/settlement/apply-transfers';
import type { Member } from '@/lib/settlement/types';
import {
  createExpenseSchema,
  deleteExpenseSchema,
  incomeSchema,
  monthSchema,
  ruleSchema,
  updateExpenseSchema,
  createSettlementSchema,
  settlementTransitionSchema,
  recurringSchema,
  monthTransitionSchema,
  categorySchema,
  categoryStatusSchema,
  redistributionSchema,
} from './schema';
import { shiftMonth, transferDate } from './month';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Household = typeof households.$inferSelect;
export class FinanceError extends Error {}
export class MissingHouseholdError extends FinanceError {}
const unavailable = () =>
  new FinanceError('Este lançamento não está disponível no seu casal.');

export async function actorHousehold(
  tx: Tx,
  userId: string,
  lock: boolean,
): Promise<Household> {
  if (!lock) {
    const [row] = await tx
      .select({ household: households })
      .from(householdMembers)
      .innerJoin(user, eq(user.id, householdMembers.userId))
      .innerJoin(households, eq(households.id, householdMembers.householdId))
      .where(
        and(eq(householdMembers.userId, userId), eq(user.emailVerified, true)),
      )
      .limit(1);
    if (!row)
      throw new MissingHouseholdError(
        'Entre no espaço do casal para continuar.',
      );
    return row.household;
  }
  const [member] = await tx
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .innerJoin(user, eq(user.id, householdMembers.userId))
    .where(
      and(eq(householdMembers.userId, userId), eq(user.emailVerified, true)),
    )
    .limit(1);
  if (!member)
    throw new MissingHouseholdError('Entre no espaço do casal para continuar.');
  const query = tx
    .select()
    .from(households)
    .where(eq(households.id, member.householdId));
  const [household] = await (lock ? query.for('update') : query);
  if (!household)
    throw new FinanceError('O espaço do casal não está disponível.');
  return household;
}

async function openMonth(tx: Tx, household: Household, month: string) {
  const date = `${month}-01`;
  await tx
    .insert(financialMonths)
    .values({
      householdId: household.id,
      month: date,
      splitMode: household.splitMode,
      higherShareBps: household.higherShareBps,
      tiebreakUserId: household.tiebreakUserId,
      designatedPayerId: household.designatedPayerId,
      transferDay: household.transferDay,
    })
    .onConflictDoNothing();
  const [period] = await tx
    .select()
    .from(financialMonths)
    .where(
      and(
        eq(financialMonths.householdId, household.id),
        eq(financialMonths.month, date),
      ),
    );
  if (period!.closedAt)
    throw new FinanceError(
      'Este mês está fechado. Reabra o período antes de alterar lançamentos.',
    );
  return period!;
}

async function checkExpenseReferences(
  tx: Tx,
  householdId: string,
  categoryId: string,
  payer: string | null,
  allowArchivedCategory = false,
) {
  const [category] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.householdId, householdId),
        eq(categories.id, categoryId),
        allowArchivedCategory ? undefined : eq(categories.active, true),
      ),
    );
  if (!category) throw new FinanceError('Escolha uma categoria do seu casal.');
  if (payer !== null) {
    const [member] = await tx
      .select({ id: householdMembers.userId })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, payer),
        ),
      );
    if (!member)
      throw new FinanceError('O pagador precisa fazer parte do casal.');
  }
}

async function checkTotal(
  tx: Tx,
  householdId: string,
  month: string,
  amount: number,
  exceptId?: string,
) {
  const [row] = await tx
    .select({
      total: sql<string>`coalesce(sum(${expenses.amountCents}), 0)::text`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.householdId, householdId),
        eq(expenses.month, `${month}-01`),
        exceptId ? ne(expenses.id, exceptId) : undefined,
      ),
    );
  if (BigInt(row!.total) + BigInt(amount) > BigInt(Number.MAX_SAFE_INTEGER))
    throw new FinanceError(
      'O total do mês ultrapassa o limite de valores suportado.',
    );
}

export async function saveIncome(db: Database, userId: string, raw: unknown) {
  const input = incomeSchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    const period = await openMonth(tx, household, input.month);
    const where = and(
      eq(incomes.householdId, household.id),
      eq(incomes.userId, userId),
      eq(incomes.month, period.month),
    );
    const [existing] = await tx.select().from(incomes).where(where);
    if ((existing?.version ?? 0) !== input.version)
      throw new FinanceError(
        'Sua renda foi alterada em outra aba. Atualize a página antes de salvar.',
      );
    if (existing) {
      const [updated] = await tx
        .update(incomes)
        .set({
          amountCents: input.amount,
          version: existing.version + 1,
          confirmedAt: sql`clock_timestamp()`,
        })
        .where(where)
        .returning();
      return updated!;
    }
    const [created] = await tx
      .insert(incomes)
      .values({
        householdId: household.id,
        userId,
        month: period.month,
        amountCents: input.amount,
      })
      .returning();
    return created!;
  });
}

export async function createExpense(
  db: Database,
  userId: string,
  raw: unknown,
) {
  const input = createExpenseSchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    const period = await openMonth(tx, household, input.month);
    const [existing] = await tx
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.householdId, household.id),
          eq(expenses.creationKey, input.creationKey),
        ),
      );
    await checkExpenseReferences(
      tx,
      household.id,
      input.categoryId,
      input.paidByUserId,
      existing?.categoryId === input.categoryId,
    );
    if (existing) {
      if (
        existing.month === period.month &&
        existing.description === input.description &&
        existing.amountCents === input.amount &&
        existing.dueDate === input.dueDate &&
        existing.categoryId === input.categoryId &&
        existing.paidByUserId === input.paidByUserId &&
        existing.notes === input.notes
      )
        return existing;
      throw new FinanceError(
        'Este formulário já foi usado. Abra uma nova despesa para continuar.',
      );
    }
    await checkTotal(tx, household.id, input.month, input.amount);
    const [expense] = await tx
      .insert(expenses)
      .values({
        householdId: household.id,
        month: period.month,
        description: input.description,
        amountCents: input.amount,
        dueDate: input.dueDate,
        categoryId: input.categoryId,
        paidByUserId: input.paidByUserId,
        paidAt: input.paidByUserId ? new Date() : null,
        notes: input.notes,
        createdBy: userId,
        creationKey: input.creationKey,
      })
      .returning();
    return expense!;
  });
}

export async function updateExpense(
  db: Database,
  userId: string,
  raw: unknown,
) {
  const input = updateExpenseSchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    const where = and(
      eq(expenses.householdId, household.id),
      eq(expenses.month, `${input.month}-01`),
      eq(expenses.id, input.id),
    );
    const [existing] = await tx.select().from(expenses).where(where);
    if (!existing) throw unavailable();
    await openMonth(tx, household, input.month);
    if (existing.version !== input.version)
      throw new FinanceError(
        'Esta despesa foi alterada por outra pessoa ou aba. Atualize a página antes de salvar.',
      );
    await checkExpenseReferences(
      tx,
      household.id,
      input.categoryId,
      input.paidByUserId,
      existing.categoryId === input.categoryId,
    );
    await checkTotal(tx, household.id, input.month, input.amount, existing.id);
    const [updated] = await tx
      .update(expenses)
      .set({
        description: input.description,
        amountCents: input.amount,
        dueDate: input.dueDate,
        categoryId: input.categoryId,
        paidByUserId: input.paidByUserId,
        paidAt: input.paidByUserId ? (existing.paidAt ?? new Date()) : null,
        notes: input.notes,
        version: existing.version + 1,
        updatedAt: sql`clock_timestamp()`,
      })
      .where(where)
      .returning();
    return updated!;
  });
}

export async function deleteExpense(
  db: Database,
  userId: string,
  raw: unknown,
) {
  const input = deleteExpenseSchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    const where = and(
      eq(expenses.householdId, household.id),
      eq(expenses.month, `${input.month}-01`),
      eq(expenses.id, input.id),
    );
    const [existing] = await tx.select().from(expenses).where(where);
    if (!existing) throw unavailable();
    await openMonth(tx, household, input.month);
    if (existing.version !== input.version)
      throw new FinanceError(
        'A despesa mudou desde que a tela foi aberta. Atualize antes de excluir.',
      );
    await tx.delete(expenses).where(where);
  });
}

export async function updateDefaultRule(
  db: Database,
  userId: string,
  raw: unknown,
) {
  const input = ruleSchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    const members = await tx
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, household.id));
    for (const id of [input.designatedPayerId, input.tiebreakUserId]) {
      if (id && !members.some((member) => member.userId === id))
        throw new FinanceError(
          'Escolha somente membros do casal para a regra.',
        );
    }
    await tx
      .update(households)
      .set({
        splitMode: input.splitMode,
        higherShareBps: input.sharePercent,
        transferDay: input.transferDay,
        designatedPayerId: input.designatedPayerId,
        tiebreakUserId: input.tiebreakUserId,
      })
      .where(eq(households.id, household.id));
  });
}

export async function getMonthlyFinance(
  db: Database,
  userId: string,
  rawMonth: string,
  scope: 'complete' | 'dashboard' | 'settlements' = 'complete',
) {
  const month = monthSchema.parse(rawMonth);
  return db.transaction((tx) => readMonthlyFinance(tx, userId, month, scope), {
    isolationLevel: 'repeatable read',
    accessMode: 'read only',
  });
}

async function readMonthlyFinance(
  tx: Tx,
  userId: string,
  month: string,
  scope: 'complete' | 'dashboard' | 'settlements' = 'complete',
) {
  const household = await actorHousehold(tx, userId, false);
  const members = await tx
    .select({
      userId: householdMembers.userId,
      displayName: householdMembers.displayName,
      slot: householdMembers.slot,
    })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, household.id))
    .orderBy(householdMembers.slot);
  const [period] = await tx
    .select()
    .from(financialMonths)
    .where(
      and(
        eq(financialMonths.householdId, household.id),
        eq(financialMonths.month, `${month}-01`),
      ),
    );
  const rule = period ?? household;
  const monthlyIncomes = await tx
    .select()
    .from(incomes)
    .where(
      and(
        eq(incomes.householdId, household.id),
        eq(incomes.month, `${month}-01`),
      ),
    );
  const previousIncomes =
    scope === 'complete'
      ? await tx
          .select()
          .from(incomes)
          .where(
            and(
              eq(incomes.householdId, household.id),
              eq(incomes.month, `${shiftMonth(month, -1)}-01`),
            ),
          )
      : [];
  const monthlyExpenses = await tx
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.householdId, household.id),
        eq(expenses.month, `${month}-01`),
      ),
    )
    .orderBy(asc(expenses.dueDate), asc(expenses.createdAt), asc(expenses.id));
  const categoryList =
    scope !== 'settlements'
      ? await tx
          .select()
          .from(categories)
          .where(eq(categories.householdId, household.id))
          .orderBy(asc(categories.name))
      : [];
  const monthlySettlements = await tx
    .select()
    .from(settlements)
    .where(
      and(
        eq(settlements.householdId, household.id),
        eq(settlements.month, `${month}-01`),
      ),
    )
    .orderBy(desc(settlements.createdAt), desc(settlements.id));
  const ready =
    members.length === 2 &&
    members.every((member) =>
      monthlyIncomes.some((income) => income.userId === member.userId),
    );
  const result = ready
    ? calculate(
        members.map((member) => ({
          userId: member.userId,
          incomeCents: monthlyIncomes.find(
            (income) => income.userId === member.userId,
          )!.amountCents,
        })) as [Member, Member],
        {
          mode: rule.splitMode,
          higherShareBps: rule.higherShareBps,
          tiebreakUserId: rule.tiebreakUserId ?? undefined,
        },
        monthlyExpenses,
      )
    : null;
  const capacitySuggestion = result
    ? suggestCapacity(
        members.map((member) => ({
          userId: member.userId,
          incomeCents: monthlyIncomes.find(
            (income) => income.userId === member.userId,
          )!.amountCents,
        })) as [Member, Member],
        result.shares,
      )
    : null;
  const adjusted =
    result && period?.redistributeByIncome && capacitySuggestion
      ? {
          ...result,
          shares: capacitySuggestion.shares,
          balances: Object.fromEntries(
            members.map((member) => [
              member.userId,
              capacitySuggestion.shares[member.userId]! -
                result.paid[member.userId]!,
            ]),
          ),
        }
      : result;
  const incomeTotal = monthlyIncomes.reduce(
    (sum, income) => sum + BigInt(income.amountCents),
    0n,
  );
  if (incomeTotal > BigInt(Number.MAX_SAFE_INTEGER))
    throw new FinanceError(
      'A renda total do mês ultrapassa o limite suportado.',
    );
  const totalCents = monthlyExpenses.reduce(
    (sum, expense) => sum + BigInt(expense.amountCents),
    0n,
  );
  const unpaidCents = monthlyExpenses
    .filter((expense) => expense.paidByUserId === null)
    .reduce((sum, expense) => sum + BigInt(expense.amountCents), 0n);
  if (totalCents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new FinanceError('O total do mês ultrapassa o limite suportado.');
  const reconciled = adjusted
    ? applyTransfers(
        adjusted,
        monthlySettlements.filter((item) => item.status === 'confirmed'),
      )
    : null;
  const frozen = period?.closedAt ? period.snapshot : null;
  const periodCategories =
    frozen && Array.isArray(frozen.data.categories)
      ? (frozen.data.categories as Array<(typeof categoryList)[number]>).map(
          (category) => ({ ...category, active: category.active ?? true }),
        )
      : categoryList;
  return {
    month,
    household,
    members,
    period: period ?? null,
    rule,
    incomeTotalCents: Number(incomeTotal),
    incomes: monthlyIncomes,
    previousIncomes,
    expenses: monthlyExpenses,
    categories: categoryList,
    displayCategories: periodCategories,
    result: frozen?.result ?? reconciled,
    capacitySuggestion: frozen ? null : capacitySuggestion,
    settlements: monthlySettlements,
    totalCents: frozen?.totalCents ?? Number(totalCents),
    unpaidCents: frozen?.unpaidCents ?? Number(unpaidCents),
  };
}

export type MonthlyFinance = Awaited<ReturnType<typeof getMonthlyFinance>>;

export async function saveCategory(db: Database, userId: string, raw: unknown) {
  const input = categorySchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    const where = and(
      eq(categories.householdId, household.id),
      sql`lower(${categories.name}) = lower(${input.name})`,
      input.id ? ne(categories.id, input.id) : undefined,
    );
    const [duplicate] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(where)
      .limit(1);
    if (duplicate)
      throw new FinanceError('Já existe uma categoria com esse nome.');

    if (input.id) {
      const [existing] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.householdId, household.id),
            eq(categories.id, input.id),
          ),
        )
        .limit(1);
      if (!existing) throw unavailable();
      const [updated] = await tx
        .update(categories)
        .set({ name: input.name, color: input.color })
        .where(
          and(
            eq(categories.householdId, household.id),
            eq(categories.id, input.id),
          ),
        )
        .returning();
      return updated!;
    }

    const [created] = await tx
      .insert(categories)
      .values({
        householdId: household.id,
        name: input.name,
        color: input.color,
      })
      .returning();
    return created!;
  });
}

export async function setCategoryActive(
  db: Database,
  userId: string,
  raw: unknown,
) {
  const input = categoryStatusSchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    const where = and(
      eq(categories.householdId, household.id),
      eq(categories.id, input.id),
    );
    const [category] = await tx.select().from(categories).where(where).limit(1);
    if (!category) throw unavailable();
    if (!input.active && category.active) {
      const [otherActive] = await tx
        .select({ total: count() })
        .from(categories)
        .where(
          and(
            eq(categories.householdId, household.id),
            eq(categories.active, true),
            ne(categories.id, category.id),
          ),
        );
      if (!otherActive?.total)
        throw new FinanceError('Mantenha ao menos uma categoria ativa.');
      const [recurring] = await tx
        .select({ id: recurringExpenses.id })
        .from(recurringExpenses)
        .where(
          and(
            eq(recurringExpenses.householdId, household.id),
            eq(recurringExpenses.categoryId, category.id),
            eq(recurringExpenses.active, true),
          ),
        )
        .limit(1);
      if (recurring)
        throw new FinanceError(
          'Pause as recorrências que usam esta categoria antes de arquivá-la.',
        );
    }
    const [updated] = await tx
      .update(categories)
      .set({ active: input.active })
      .where(where)
      .returning();
    return updated!;
  });
}

export async function createSettlement(
  db: Database,
  userId: string,
  raw: unknown,
) {
  const input = createSettlementSchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    await openMonth(tx, household, input.month);
    const [existing] = await tx
      .select()
      .from(settlements)
      .where(
        and(
          eq(settlements.householdId, household.id),
          eq(settlements.creationKey, input.creationKey),
        ),
      );
    if (existing) {
      if (
        existing.fromUserId === userId &&
        existing.amountCents === input.amount &&
        existing.month === `${input.month}-01`
      )
        return existing;
      throw new FinanceError(
        'Este formulário já foi usado. Atualize a página.',
      );
    }
    const data = await readMonthlyFinance(tx, userId, input.month);
    if (data.settlements.some((item) => item.status === 'pending'))
      throw new FinanceError(
        'Confirme ou cancele o repasse pendente antes de registrar outro.',
      );
    const transfer = data.result?.transfer;
    if (!transfer || transfer.from !== userId)
      throw new FinanceError(
        'Somente quem tem valor a repassar pode registrar o envio.',
      );
    if (input.amount > transfer.amountCents)
      throw new FinanceError(
        'O valor ultrapassa o saldo atual a repassar. Atualize o painel.',
      );
    const [created] = await tx
      .insert(settlements)
      .values({
        householdId: household.id,
        month: `${input.month}-01`,
        fromUserId: userId,
        toUserId: transfer.to,
        amountCents: input.amount,
        creationKey: input.creationKey,
      })
      .returning();
    return created!;
  });
}

export async function transitionSettlement(
  db: Database,
  userId: string,
  raw: unknown,
) {
  const input = settlementTransitionSchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    const where = and(
      eq(settlements.householdId, household.id),
      eq(settlements.month, `${input.month}-01`),
      eq(settlements.id, input.id),
    );
    const [existing] = await tx.select().from(settlements).where(where);
    if (!existing)
      throw new FinanceError('Este repasse não está disponível no seu casal.');
    await openMonth(tx, household, input.month);
    if (input.action === 'confirm' && existing.toUserId !== userId)
      throw new FinanceError('Somente quem recebe pode confirmar o repasse.');
    if (
      input.action === 'cancel' &&
      ![existing.fromUserId, existing.toUserId].includes(userId)
    )
      throw new FinanceError('Você não pode cancelar este repasse.');
    const target = input.action === 'confirm' ? 'confirmed' : 'cancelled';
    if (existing.status === target) return existing;
    if (existing.status !== 'pending')
      throw new FinanceError('Este repasse já foi concluído ou cancelado.');
    const [updated] = await tx
      .update(settlements)
      .set({
        status: target,
        confirmedAt: target === 'confirmed' ? new Date() : null,
      })
      .where(where)
      .returning();
    return updated!;
  });
}

async function generateRecurringInTransaction(
  tx: Tx,
  household: Household,
  month: string,
) {
  const date = `${month}-01`;
  const [existingMonth] = await tx
    .select()
    .from(financialMonths)
    .where(
      and(
        eq(financialMonths.householdId, household.id),
        eq(financialMonths.month, date),
      ),
    );
  if (existingMonth?.closedAt) return 0;
  const templates = await tx
    .select()
    .from(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.householdId, household.id),
        eq(recurringExpenses.active, true),
        lte(recurringExpenses.startMonth, date),
      ),
    );
  const occurrences = await tx
    .select()
    .from(recurringOccurrences)
    .where(
      and(
        eq(recurringOccurrences.householdId, household.id),
        eq(recurringOccurrences.month, date),
      ),
    );
  const missing = templates.filter(
    (template) =>
      !occurrences.some((occurrence) => occurrence.recurringId === template.id),
  );
  if (!missing.length) return 0;
  await openMonth(tx, household, month);
  for (const template of missing) {
    await checkTotal(tx, household.id, month, template.amountCents);
    await tx.insert(recurringOccurrences).values({
      householdId: household.id,
      recurringId: template.id,
      month: date,
    });
    await tx.insert(expenses).values({
      householdId: household.id,
      month: date,
      description: template.description,
      amountCents: template.amountCents,
      dueDate: transferDate(month, template.dayOfMonth),
      categoryId: template.categoryId,
      createdBy: template.createdBy,
      recurringId: template.id,
      creationKey: randomUUID(),
      paidByUserId: null,
      paidAt: null,
    });
  }
  return missing.length;
}

export async function generateRecurring(
  db: Database,
  userId: string,
  rawMonth: string,
) {
  const month = monthSchema.parse(rawMonth);
  return db.transaction(async (tx) =>
    generateRecurringInTransaction(
      tx,
      await actorHousehold(tx, userId, true),
      month,
    ),
  );
}

export async function getRecurring(db: Database, userId: string) {
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, false);
    return tx
      .select()
      .from(recurringExpenses)
      .where(eq(recurringExpenses.householdId, household.id))
      .orderBy(asc(recurringExpenses.description), asc(recurringExpenses.id));
  });
}

export async function saveRecurring(
  db: Database,
  userId: string,
  raw: unknown,
) {
  const input = recurringSchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    const values = {
      description: input.description,
      amountCents: input.amount,
      categoryId: input.categoryId,
      dayOfMonth: input.dayOfMonth,
      active: input.active,
    };
    let id: string;
    if (input.id) {
      const where = and(
        eq(recurringExpenses.householdId, household.id),
        eq(recurringExpenses.id, input.id),
      );
      const [existing] = await tx.select().from(recurringExpenses).where(where);
      if (!existing) throw unavailable();
      if (existing.version !== input.version)
        throw new FinanceError(
          'A recorrência mudou. Atualize a página antes de salvar.',
        );
      if (existing.startMonth !== `${input.startMonth}-01`)
        throw new FinanceError('A competência inicial não pode ser alterada.');
      await checkExpenseReferences(
        tx,
        household.id,
        input.categoryId,
        null,
        !input.active && existing.categoryId === input.categoryId,
      );
      await tx
        .update(recurringExpenses)
        .set({ ...values, version: existing.version + 1 })
        .where(where);
      id = existing.id;
    } else {
      await checkExpenseReferences(tx, household.id, input.categoryId, null);
      const [existing] = await tx
        .select()
        .from(recurringExpenses)
        .where(
          and(
            eq(recurringExpenses.householdId, household.id),
            eq(recurringExpenses.creationKey, input.creationKey),
          ),
        );
      if (existing) return existing.id;
      const [period] = await tx
        .select()
        .from(financialMonths)
        .where(
          and(
            eq(financialMonths.householdId, household.id),
            eq(financialMonths.month, `${input.startMonth}-01`),
          ),
        );
      if (period?.closedAt)
        throw new FinanceError(
          'Escolha uma competência inicial que esteja aberta.',
        );
      const [created] = await tx
        .insert(recurringExpenses)
        .values({
          ...values,
          householdId: household.id,
          startMonth: `${input.startMonth}-01`,
          createdBy: userId,
          creationKey: input.creationKey,
        })
        .returning({ id: recurringExpenses.id });
      id = created!.id;
    }
    await generateRecurringInTransaction(tx, household, input.startMonth);
    return id;
  });
}

export function monthFingerprint(data: MonthlyFinance): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        month: data.month,
        closedAt: data.period?.closedAt ?? null,
        redistributeByIncome: data.period?.redistributeByIncome ?? false,
        rule: [
          data.rule.splitMode,
          data.rule.higherShareBps,
          data.rule.tiebreakUserId,
          data.rule.designatedPayerId,
          data.rule.transferDay,
        ],
        members: data.members,
        incomes: data.incomes,
        expenses: data.expenses,
        settlements: data.settlements,
      }),
    )
    .digest('hex');
}

export async function transitionMonth(
  db: Database,
  userId: string,
  raw: unknown,
) {
  const input = monthTransitionSchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    const where = and(
      eq(financialMonths.householdId, household.id),
      eq(financialMonths.month, `${input.month}-01`),
    );
    if (input.action === 'reopen') {
      const [period] = await tx.select().from(financialMonths).where(where);
      if (!period?.closedAt || period.closedAt.toISOString() !== input.closedAt)
        throw new FinanceError('O estado do mês mudou. Atualize a página.');
      await tx.update(financialMonths).set({ closedAt: null }).where(where);
      return;
    }
    await generateRecurringInTransaction(tx, household, input.month);
    const data = await readMonthlyFinance(tx, userId, input.month);
    if (data.period?.closedAt)
      throw new FinanceError('Este mês já está fechado.');
    if (!data.result)
      throw new FinanceError(
        'Confirme as rendas dos dois membros antes de fechar o mês.',
      );
    if (data.unpaidCents > 0)
      throw new FinanceError(
        'Há contas a pagar. Confirme os pagamentos antes de fechar.',
      );
    if (
      data.settlements.some((item) => item.status === 'pending') ||
      data.result.transfer
    )
      throw new FinanceError(
        'Conclua os repasses e confirme os recebimentos antes de fechar.',
      );
    if (monthFingerprint(data) !== input.fingerprint)
      throw new FinanceError(
        'Os dados do mês mudaram. Atualize e confira antes de fechar.',
      );
    const now = new Date();
    const snapshot = {
      version: 1 as const,
      capturedAt: now.toISOString(),
      closedBy: userId,
      totalCents: data.totalCents,
      unpaidCents: data.unpaidCents,
      result: data.result,
      data: JSON.parse(
        JSON.stringify({
          members: data.members,
          redistributeByIncome: data.period?.redistributeByIncome ?? false,
          rule: {
            mode: data.rule.splitMode,
            higherShareBps: data.rule.higherShareBps,
            tiebreakUserId: data.rule.tiebreakUserId,
            designatedPayerId: data.rule.designatedPayerId,
            transferDay: data.rule.transferDay,
          },
          incomes: data.incomes,
          expenses: data.expenses,
          categories: data.displayCategories,
          settlements: data.settlements,
        }),
      ),
    };
    await tx
      .update(financialMonths)
      .set({ closedAt: now, snapshot })
      .where(where);
  });
}

/** O lock é o mesmo das rendas, despesas, repasses e fechamento. */
export async function setIncomeRedistribution(
  db: Database,
  userId: string,
  raw: unknown,
) {
  const input = redistributionSchema.parse(raw);
  return db.transaction(async (tx) => {
    const household = await actorHousehold(tx, userId, true);
    const data = await readMonthlyFinance(tx, userId, input.month);
    if (data.period?.closedAt)
      throw new FinanceError(
        'Este mês está fechado. Reabra o período antes de redistribuir.',
      );
    if (monthFingerprint(data) !== input.fingerprint)
      throw new FinanceError(
        'As contas ou rendas mudaram. Atualize o painel e confira a nova sugestão.',
      );
    if (data.settlements.some((item) => item.status === 'pending'))
      throw new FinanceError(
        'Confirme ou cancele os repasses pendentes antes de redistribuir.',
      );
    if (
      input.enabled &&
      (!data.result || !data.capacitySuggestion?.redistributedCents)
    )
      throw new FinanceError(
        'Não há valor que possa ser redistribuído com as rendas atuais.',
      );
    await openMonth(tx, household, input.month);
    await tx
      .update(financialMonths)
      .set({ redistributeByIncome: input.enabled })
      .where(
        and(
          eq(financialMonths.householdId, household.id),
          eq(financialMonths.month, `${input.month}-01`),
        ),
      );
  });
}
