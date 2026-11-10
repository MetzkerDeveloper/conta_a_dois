import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { and, eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import {
  createHousehold,
  createHouseholdInvite,
  acceptHouseholdInvite,
} from '@/features/household/service';
import {
  createExpense,
  deleteExpense,
  getMonthlyFinance,
  saveIncome,
  payExpense,
  updateDefaultRule,
  updateExpense,
  saveCategory,
  setCategoryActive,
  saveRecurring,
} from '@/features/finance/service';
import { inputMoney } from '@/features/finance/month';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test'))
  throw new Error(
    'Use um TEST_DATABASE_URL isolado com nome terminado em _test.',
  );
const pool = new Pool({
  connectionString,
  max: 8,
  connectionTimeoutMillis: 5000,
});
const db = drizzle({ client: pool, schema });
beforeAll(async () => {
  await migrate(db, { migrationsFolder: './db/migrations' });
});
afterAll(async () => {
  await pool.end();
});

async function person(name: string) {
  const id = randomUUID();
  await db
    .insert(schema.user)
    .values({ id, name, email: `${id}@example.test`, emailVerified: true });
  return id;
}
async function fixture() {
  const owner = await person('Ana');
  const partner = await person('Bruno');
  const household = await createHousehold(db, owner, {
    name: 'Casa real de teste',
    displayName: 'Ana',
    splitMode: 'fixed',
    higherShareBps: 7000,
    transferDay: 25,
    consent: true,
  });
  const invite = await createHouseholdInvite(db, owner);
  await acceptHouseholdInvite(db, partner, {
    token: invite.token,
    displayName: 'Bruno',
    consent: true,
  });
  const data = await getMonthlyFinance(db, owner, '2026-11');
  const expense = {
    month: '2026-11',
    description: 'Aluguel',
    amount: '4.000,00',
    dueDate: '2026-11-05',
    categoryId: data.categories.find((category) => category.name === 'Moradia')!
      .id,
    paidByUserId: owner,
    notes: '',
    creationKey: randomUUID(),
  };
  return { owner, partner, household, data, expense };
}
async function confirmIncomes(
  f: Awaited<ReturnType<typeof fixture>>,
  month = '2026-11',
) {
  await saveIncome(db, f.owner, { month, amount: '7.000,00', version: 0 });
  await saveIncome(db, f.partner, { month, amount: '3.000,00', version: 0 });
}

describe('finanças persistidas e autorizadas por casal', () => {
  it('persiste renda, despesa e repasse do exemplo 70/30 nas duas sessões', async () => {
    const f = await fixture();
    expect(f.data.categories).toHaveLength(7);
    await confirmIncomes(f);
    await createExpense(db, f.owner, f.expense);
    const data = await getMonthlyFinance(db, f.partner, '2026-11');
    expect(data.totalCents).toBe(400000);
    expect(data.result!.shares).toEqual({
      [f.owner]: 280000,
      [f.partner]: 120000,
    });
    expect(data.result!.transfer).toEqual({
      from: f.partner,
      to: f.owner,
      amountCents: 120000,
    });
    expect(data.expenses[0]!.createdBy).toBe(f.owner);
  });
  it('não usa renda anterior como confirmada e mantém competências separadas', async () => {
    const f = await fixture();
    await confirmIncomes(f, '2026-10');
    await createExpense(db, f.owner, f.expense);
    const nov = await getMonthlyFinance(db, f.owner, '2026-11');
    expect(nov.result).toBeNull();
    expect(nov.previousIncomes).toHaveLength(2);
    expect(nov.incomes).toHaveLength(0);
    expect(
      (await getMonthlyFinance(db, f.owner, '2026-10')).expenses,
    ).toHaveLength(0);
  });
  it('trata despesas pendentes sem atribuir a um membro um crédito não pago', async () => {
    const f = await fixture();
    await confirmIncomes(f);
    await createExpense(db, f.owner, { ...f.expense, amount: '80,00' });
    await createExpense(db, f.owner, {
      ...f.expense,
      creationKey: randomUUID(),
      amount: '20,00',
      paidByUserId: null,
    });
    const data = await getMonthlyFinance(db, f.owner, '2026-11');
    expect(data.unpaidCents).toBe(2000);
    expect(data.result!.transfer).toEqual({
      from: f.partner,
      to: f.owner,
      amountCents: 1000,
    });
  });
  it('edita pagamento, categoria, notas e vencimento e exclui com recálculo', async () => {
    const f = await fixture();
    await confirmIncomes(f);
    const expense = await createExpense(db, f.owner, {
      ...f.expense,
      paidByUserId: null,
    });
    const edited = await updateExpense(db, f.partner, {
      ...f.expense,
      id: expense.id,
      version: 1,
      dueDate: '2026-12-05',
      notes: 'Vence no mês seguinte',
      paidByUserId: f.partner,
    });
    expect(edited.paidAt).toBeInstanceOf(Date);
    expect(edited.month).toBe('2026-11-01');
    expect(
      (await getMonthlyFinance(db, f.owner, '2026-11')).result!.transfer,
    ).toEqual({ from: f.owner, to: f.partner, amountCents: 280000 });
    await deleteExpense(db, f.partner, {
      month: '2026-11',
      id: expense.id,
      version: edited.version,
    });
    expect((await getMonthlyFinance(db, f.owner, '2026-11')).totalCents).toBe(
      0,
    );
  });
  it('nega acesso a despesas, pagadores e categorias de outro casal', async () => {
    const f = await fixture();
    const other = await fixture();
    const expense = await createExpense(db, f.owner, f.expense);
    expect(
      (await getMonthlyFinance(db, other.owner, '2026-11')).expenses,
    ).toHaveLength(0);
    await expect(
      updateExpense(db, other.owner, {
        ...f.expense,
        id: expense.id,
        version: 1,
      }),
    ).rejects.toThrow('não está disponível');
    await expect(
      deleteExpense(db, other.owner, {
        month: '2026-11',
        id: expense.id,
        version: 1,
      }),
    ).rejects.toThrow('não está disponível');
    await expect(
      createExpense(db, other.owner, {
        ...other.expense,
        categoryId: f.expense.categoryId,
      }),
    ).rejects.toThrow('categoria do seu casal');
    await expect(
      createExpense(db, other.owner, {
        ...other.expense,
        paidByUserId: f.owner,
      }),
    ).rejects.toThrow('pagador precisa');
    expect((await getMonthlyFinance(db, f.owner, '2026-11')).totalCents).toBe(
      400000,
    );
  });
  it('usa somente a identidade do ator para salvar a renda', async () => {
    const f = await fixture();
    await saveIncome(db, f.owner, {
      month: '2026-11',
      amount: '0,00',
      version: 0,
      userId: f.partner,
      householdId: randomUUID(),
    });
    const data = await getMonthlyFinance(db, f.partner, '2026-11');
    expect(data.incomes).toHaveLength(1);
    expect(data.incomes[0]!.userId).toBe(f.owner);
    expect(data.incomes[0]!.amountCents).toBe(0);
  });
  it('impede despesas duplicadas no reenvio simultâneo do mesmo formulário', async () => {
    const f = await fixture();
    const [one, two] = await Promise.all([
      createExpense(db, f.owner, f.expense),
      createExpense(db, f.owner, f.expense),
    ]);
    expect(one.id).toBe(two.id);
    expect(
      (await getMonthlyFinance(db, f.owner, '2026-11')).expenses,
    ).toHaveLength(1);
    await expect(
      createExpense(db, f.owner, { ...f.expense, amount: '5.000,00' }),
    ).rejects.toThrow('formulário já foi usado');
  });
  it('rejeita edições e exclusões com versão antiga', async () => {
    const f = await fixture();
    const expense = await createExpense(db, f.owner, f.expense);
    await updateExpense(db, f.owner, {
      ...f.expense,
      id: expense.id,
      version: 1,
      amount: '3.000,00',
    });
    await expect(
      updateExpense(db, f.partner, {
        ...f.expense,
        id: expense.id,
        version: 1,
      }),
    ).rejects.toThrow('alterada');
    await expect(
      deleteExpense(db, f.partner, {
        month: '2026-11',
        id: expense.id,
        version: 1,
      }),
    ).rejects.toThrow('mudou');
    await saveIncome(db, f.owner, {
      month: '2026-11',
      amount: '7.000,00',
      version: 0,
    });
    await expect(
      saveIncome(db, f.owner, {
        month: '2026-11',
        amount: '5.000,00',
        version: 0,
      }),
    ).rejects.toThrow('outra aba');
  });
  it('guarda a regra no mês iniciado e aplica novas regras às competências sem lançamentos', async () => {
    const f = await fixture();
    await confirmIncomes(f);
    await updateDefaultRule(db, f.owner, {
      splitMode: 'fixed',
      sharePercent: '60',
      transferDay: 31,
      designatedPayerId: f.partner,
      tiebreakUserId: f.owner,
    });
    const old = await getMonthlyFinance(db, f.owner, '2026-11');
    expect(old.rule.higherShareBps).toBe(7000);
    expect(old.rule.transferDay).toBe(25);
    const next = await getMonthlyFinance(db, f.owner, '2026-12');
    expect(next.rule.higherShareBps).toBe(6000);
    expect(next.rule.designatedPayerId).toBe(f.partner);
    expect(next.period).toBeNull();
    await saveIncome(db, f.owner, {
      month: '2026-12',
      amount: '1,00',
      version: 0,
    });
    expect(
      (await getMonthlyFinance(db, f.owner, '2026-12')).period!.higherShareBps,
    ).toBe(6000);
    await expect(
      updateDefaultRule(db, f.owner, {
        splitMode: 'equal',
        sharePercent: '50',
        transferDay: 25,
        designatedPayerId: randomUUID(),
        tiebreakUserId: null,
      }),
    ).rejects.toThrow('membros do casal');
  });
  it('bloqueia mutações quando o período está fechado', async () => {
    const f = await fixture();
    const expense = await createExpense(db, f.owner, f.expense);
    await db
      .update(schema.financialMonths)
      .set({ closedAt: new Date() })
      .where(
        and(
          eq(schema.financialMonths.householdId, f.household.id),
          eq(schema.financialMonths.month, '2026-11-01'),
        ),
      );
    await expect(
      saveIncome(db, f.owner, { month: '2026-11', amount: '1,00', version: 0 }),
    ).rejects.toThrow('fechado');
    await expect(
      createExpense(db, f.owner, { ...f.expense, creationKey: randomUUID() }),
    ).rejects.toThrow('fechado');
    await expect(
      updateExpense(db, f.owner, { ...f.expense, id: expense.id, version: 1 }),
    ).rejects.toThrow('fechado');
    await expect(
      deleteExpense(db, f.owner, {
        month: '2026-11',
        id: expense.id,
        version: 1,
      }),
    ).rejects.toThrow('fechado');
  });
  it('impede overflow no total do mês e mantém o valor anterior', async () => {
    const f = await fixture();
    await createExpense(db, f.owner, {
      ...f.expense,
      amount: inputMoney(Number.MAX_SAFE_INTEGER),
    });
    await expect(
      createExpense(db, f.partner, {
        ...f.expense,
        amount: '0,01',
        creationKey: randomUUID(),
      }),
    ).rejects.toThrow('limite');
    expect((await getMonthlyFinance(db, f.owner, '2026-11')).totalCents).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
  it('mantém a integridade entre categoria e casal também no banco', async () => {
    const f = await fixture();
    const other = await fixture();
    await saveIncome(db, f.owner, {
      month: '2026-11',
      amount: '0,00',
      version: 0,
    });
    await expect(
      db.insert(schema.expenses).values({
        householdId: f.household.id,
        month: '2026-11-01',
        description: 'Categoria externa',
        amountCents: 100,
        dueDate: '2026-11-25',
        categoryId: other.expense.categoryId,
        createdBy: f.owner,
        creationKey: randomUUID(),
      }),
    ).rejects.toThrow();
  });
  it('cria, renomeia e arquiva categorias sem perder histórico nem quebrar recorrências', async () => {
    const f = await fixture();
    const category = await saveCategory(db, f.owner, {
      name: 'Pets',
      color: '#aa593a',
    });
    await expect(
      saveCategory(db, f.partner, { name: 'pets', color: '#286351' }),
    ).rejects.toThrow('Já existe');

    const recurringId = await saveRecurring(db, f.owner, {
      description: 'Ração',
      amount: '80,00',
      categoryId: category.id,
      dayOfMonth: 10,
      startMonth: '2027-01',
      active: true,
      version: 0,
      creationKey: randomUUID(),
    });
    await expect(
      setCategoryActive(db, f.partner, { id: category.id, active: false }),
    ).rejects.toThrow('Pause as recorrências');
    await saveRecurring(db, f.partner, {
      id: recurringId,
      description: 'Ração',
      amount: '80,00',
      categoryId: category.id,
      dayOfMonth: 10,
      startMonth: '2027-01',
      active: false,
      version: 1,
      creationKey: randomUUID(),
    });

    const expense = await createExpense(db, f.owner, {
      ...f.expense,
      categoryId: category.id,
    });
    await setCategoryActive(db, f.partner, { id: category.id, active: false });
    const updatedCategory = await saveCategory(db, f.partner, {
      id: category.id,
      name: 'Animais',
      color: '#aa593a',
    });
    expect(updatedCategory.active).toBe(false);
    const data = await getMonthlyFinance(db, f.owner, '2026-11');
    expect(
      data.expenses.find((item) => item.id === expense.id)?.categoryId,
    ).toBe(category.id);
    expect(data.categories.find((item) => item.id === category.id)?.name).toBe(
      'Animais',
    );
    await expect(
      createExpense(db, f.owner, {
        ...f.expense,
        categoryId: category.id,
        creationKey: randomUUID(),
      }),
    ).rejects.toThrow('categoria do seu casal');
    await setCategoryActive(db, f.owner, { id: category.id, active: true });
    expect(
      (await getMonthlyFinance(db, f.owner, '2026-11')).categories.find(
        (item) => item.id === category.id,
      )?.active,
    ).toBe(true);
  });
  it('não permite alterar categoria de outro casal nem arquivar a última ativa', async () => {
    const f = await fixture();
    const other = await fixture();
    await expect(
      saveCategory(db, f.owner, {
        id: other.data.categories[0]!.id,
        name: 'Categoria externa',
        color: '#286351',
      }),
    ).rejects.toThrow();
    await expect(
      setCategoryActive(db, f.owner, {
        id: other.data.categories[0]!.id,
        active: false,
      }),
    ).rejects.toThrow();

    const categories = (await getMonthlyFinance(db, f.owner, '2026-11'))
      .categories;
    for (const category of categories.slice(1))
      await setCategoryActive(db, f.owner, { id: category.id, active: false });
    await expect(
      setCategoryActive(db, f.owner, {
        id: categories[0]!.id,
        active: false,
      }),
    ).rejects.toThrow('ao menos uma categoria ativa');
  });
  it('confirma pagamento direto, preserva os demais campos e recalcula o acerto', async () => {
    const f = await fixture();
    await confirmIncomes(f);
    const expense = await createExpense(db, f.owner, {
      ...f.expense,
      paidByUserId: null,
    });
    expect(
      (await getMonthlyFinance(db, f.owner, '2026-11')).result!.transfer,
    ).toBeNull();
    // A categoria pode estar arquivada: só o pagamento está sendo alterado.
    await setCategoryActive(db, f.owner, {
      id: expense.categoryId,
      active: false,
    });
    const updated = await payExpense(db, f.owner, {
      id: expense.id,
      month: '2026-11',
      version: expense.version,
      paidByUserId: f.partner,
    });
    expect(updated).toMatchObject({
      ...expense,
      paidByUserId: f.partner,
      version: expense.version + 1,
      paidAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    const data = await getMonthlyFinance(db, f.partner, '2026-11');
    expect(data.unpaidCents).toBe(0);
    expect(data.result!.transfer).toEqual({
      from: f.owner,
      to: f.partner,
      amountCents: 280000,
    });
  });
  it('pagamento direto rejeita casal e pagador externos, mês errado e edições antigas', async () => {
    const f = await fixture(),
      other = await fixture();
    const expense = await createExpense(db, f.owner, {
      ...f.expense,
      paidByUserId: null,
    });
    const command = {
      id: expense.id,
      month: '2026-11',
      version: expense.version,
      paidByUserId: f.owner,
    };
    await expect(payExpense(db, other.owner, command)).rejects.toThrow(
      'não está disponível',
    );
    await expect(
      payExpense(db, f.owner, { ...command, paidByUserId: other.owner }),
    ).rejects.toThrow('pagador do seu casal');
    await expect(
      payExpense(db, f.owner, { ...command, month: '2026-12' }),
    ).rejects.toThrow('não está disponível');
    const changed = await updateExpense(db, f.partner, {
      ...f.expense,
      paidByUserId: null,
      id: expense.id,
      version: expense.version,
      notes: 'Corrigida pelo par',
    });
    await expect(payExpense(db, f.owner, command)).rejects.toThrow(
      'despesa mudou',
    );
    expect(
      (await getMonthlyFinance(db, f.owner, '2026-11')).expenses[0],
    ).toMatchObject({
      notes: changed.notes,
      paidByUserId: null,
      version: changed.version,
    });
  });
  it('serializa pagamentos simultâneos e bloqueia o pagamento de mês fechado', async () => {
    const f = await fixture();
    const expense = await createExpense(db, f.owner, {
      ...f.expense,
      paidByUserId: null,
    });
    const command = {
      id: expense.id,
      month: '2026-11',
      version: expense.version,
      paidByUserId: f.owner,
    };
    const results = await Promise.allSettled([
      payExpense(db, f.owner, command),
      payExpense(db, f.partner, { ...command, paidByUserId: f.partner }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const data = await getMonthlyFinance(db, f.owner, '2026-11');
    expect(data.expenses[0]!.version).toBe(expense.version + 1);
    const pending = await createExpense(db, f.owner, {
      ...f.expense,
      paidByUserId: null,
      creationKey: randomUUID(),
    });
    await db
      .update(schema.financialMonths)
      .set({ closedAt: new Date() })
      .where(
        and(
          eq(schema.financialMonths.householdId, f.household.id),
          eq(schema.financialMonths.month, '2026-11-01'),
        ),
      );
    await expect(
      payExpense(db, f.partner, {
        ...command,
        id: pending.id,
        version: pending.version,
      }),
    ).rejects.toThrow('mês está fechado');
  });
});
