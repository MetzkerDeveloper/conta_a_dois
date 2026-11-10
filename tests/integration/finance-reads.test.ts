import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '@/db/schema';
import {
  createHousehold,
  createHouseholdInvite,
  acceptHouseholdInvite,
} from '@/features/household/service';
import {
  createExpense,
  getMonthlyFinance,
  saveIncome,
  saveCategory,
  createSettlement,
  transitionSettlement,
  transitionMonth,
  monthFingerprint,
} from '@/features/finance/service';
import {
  getExpenseList,
  getFinanceIncomes,
  getFinanceSettings,
  getExpenseEditor,
  getFinanceRecurring,
} from '@/features/finance/read-models';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Use banco isolado terminado em _test.');
const pool = new Pool({ connectionString: url, max: 4 });
const db = drizzle({ client: pool, schema });
beforeAll(async () => {
  await migrate(db, { migrationsFolder: './db/migrations' });
});
afterAll(async () => {
  await pool.end();
});

async function fixture(size = 60) {
  const ana = randomUUID(),
    bruno = randomUUID();
  await db.insert(schema.user).values(
    [ana, bruno].map((id) => ({
      id,
      name: id,
      email: `${id}@example.test`,
      emailVerified: true,
    })),
  );
  const household = await createHousehold(db, ana, {
    name: 'Consultas',
    displayName: 'Ana',
    splitMode: 'equal',
    higherShareBps: 7000,
    transferDay: 25,
    consent: true,
  });
  const invite = await createHouseholdInvite(db, ana);
  await acceptHouseholdInvite(db, bruno, {
    token: invite.token,
    displayName: 'Bruno',
    consent: true,
  });
  const settings = await getFinanceSettings(db, ana, '2026-11');
  const category = settings.categories[0]!;
  const otherCategory = settings.categories[1]!;
  const first = await createExpense(db, ana, {
    month: '2026-11',
    description: 'Conta 00',
    amount: '1,00',
    dueDate: '2026-11-05',
    categoryId: category.id,
    paidByUserId: ana,
    notes: '',
    creationKey: randomUUID(),
  });
  if (size > 1)
    await db.insert(schema.expenses).values(
      Array.from({ length: size - 1 }, (_, offset) => {
        const i = offset + 1;
        return {
          householdId: household.id,
          month: '2026-11-01',
          description:
            i === 59
              ? 'Promoção 50%_\\ fim'
              : `Conta ${String(i).padStart(2, '0')}`,
          amountCents: 100,
          dueDate: '2026-11-05',
          categoryId: i % 2 ? otherCategory.id : category.id,
          paidByUserId: i % 2 ? null : ana,
          paidAt: i % 2 ? null : new Date(),
          createdBy: ana,
          notes: i === 59 ? 'Energia de verão' : '',
          creationKey: randomUUID(),
        };
      }),
    );
  return { ana, bruno, household, category, otherCategory, first };
}

it('pagina com ordem estável, sem repetir linhas, e mantém os totais completos', async () => {
  const f = await fixture();
  const pages = [];
  for (const page of [1, 2, 3])
    pages.push(await getExpenseList(db, f.ana, '2026-11', { page }));
  expect(pages.map((page) => page.expenses.length)).toEqual([25, 25, 10]);
  expect(
    new Set(pages.flatMap((page) => page.expenses.map((expense) => expense.id)))
      .size,
  ).toBe(60);
  for (const page of pages) {
    expect(page.totalCount).toBe(60);
    expect(page.totalCents).toBe(6000);
    expect(page.filteredCents).toBe(6000);
    expect(page.pageCount).toBe(3);
  }
  const again = await getExpenseList(db, f.ana, '2026-11', { page: 2 });
  expect(again.expenses.map((expense) => expense.id)).toEqual(
    pages[1]!.expenses.map((expense) => expense.id),
  );
  const overflow = await getExpenseList(db, f.ana, '2026-11', {
    page: Number.MAX_SAFE_INTEGER,
  });
  expect(overflow.filters.page).toBe(3);
  expect(overflow.expenses).toEqual(pages[2]!.expenses);
});
it('combina busca, categoria e pagamento no banco e trata curingas como texto literal', async () => {
  const f = await fixture();
  const filtered = await getExpenseList(db, f.ana, '2026-11', {
    search: 'CONTA',
    status: 'paid',
    category: f.category.id,
  });
  expect(filtered.filteredCount).toBe(30);
  expect(filtered.filteredCents).toBe(3000);
  expect(filtered.totalCount).toBe(60);
  expect(filtered.totalCents).toBe(6000);
  for (const search of ['50%', '%_', '\\', 'ENERGIA']) {
    const result = await getExpenseList(db, f.bruno, '2026-11', {
      search,
      status: 'pending',
    });
    expect(result.filteredCount).toBe(1);
    expect(result.expenses[0]!.description).toBe('Promoção 50%_\\ fim');
  }
  const none = await getExpenseList(db, f.ana, '2026-11', {
    search: "' OR true --",
  });
  expect(none.filteredCount).toBe(0);
  expect(none.totalCents).toBe(6000);
  const invalid = await getExpenseList(db, f.ana, '2026-11', {
    page: '-4',
    status: 'invalido',
    category: 'não-uuid',
  });
  expect(invalid.filters).toMatchObject({ page: 1, status: '', category: '' });
});
it('isola os dados por casal e competência, inclusive na edição por ID', async () => {
  const f = await fixture(1),
    other = await fixture(1);
  expect(
    (
      await getExpenseList(db, f.ana, '2026-11', {
        category: other.category.id,
      })
    ).filteredCount,
  ).toBe(0);
  expect((await getExpenseList(db, f.ana, '2026-12', {})).totalCount).toBe(0);
  expect(
    (await getExpenseEditor(db, f.ana, '2026-11', other.first.id)).expense,
  ).toBeNull();
  expect(
    (await getExpenseEditor(db, f.ana, '2026-12', f.first.id)).expense,
  ).toBeNull();
  expect(
    (await getExpenseEditor(db, f.ana, '2026-11', 'não-uuid')).expense,
  ).toBeNull();
  expect(
    (await getExpenseEditor(db, f.bruno, '2026-11', f.first.id)).expense!.id,
  ).toBe(f.first.id);
  await expect(getExpenseList(db, randomUUID(), '2026-11', {})).rejects.toThrow(
    'Entre no espaço',
  );
});
it('reduz as consultas conforme a tela e mantém o cálculo do painel e dos repasses', async () => {
  const f = await fixture(1);
  await saveIncome(db, f.ana, {
    month: '2026-10',
    amount: '900,00',
    version: 0,
  });
  await saveIncome(db, f.bruno, {
    month: '2026-10',
    amount: '800,00',
    version: 0,
  });
  await saveIncome(db, f.ana, {
    month: '2026-11',
    amount: '1000,00',
    version: 0,
  });
  await saveIncome(db, f.bruno, {
    month: '2026-11',
    amount: '1000,00',
    version: 0,
  });
  const statements: string[] = [];
  const observed = drizzle({
    client: pool,
    schema,
    logger: {
      logQuery(query) {
        if (query.startsWith('select ')) statements.push(query);
      },
    },
  });
  const cases = [
    { read: () => getFinanceSettings(observed, f.ana, '2026-11'), count: 3 },
    { read: () => getFinanceIncomes(observed, f.ana, '2026-11'), count: 4 },
    { read: () => getExpenseEditor(observed, f.ana, '2026-11'), count: 4 },
    {
      read: () => getExpenseEditor(observed, f.ana, '2026-11', f.first.id),
      count: 5,
    },
    { read: () => getFinanceRecurring(observed, f.ana, '2026-11'), count: 3 },
    { read: () => getExpenseList(observed, f.ana, '2026-11', {}), count: 6 },
  ];
  for (const item of cases) {
    statements.length = 0;
    await item.read();
    expect(statements.length).toBe(item.count);
    expect(
      statements.some((query) => query.includes('from "settlements"')),
    ).toBe(false);
  }
  const incomeData = await getFinanceIncomes(db, f.ana, '2026-11');
  expect(incomeData.incomes).toHaveLength(2);
  expect(incomeData.previousIncomes).toHaveLength(1);
  expect(incomeData.previousIncomes[0]!.userId).toBe(f.ana);
  const complete = await getMonthlyFinance(db, f.ana, '2026-11');
  for (const [scope, queries] of [
    ['dashboard', 7],
    ['settlements', 6],
  ] as const) {
    statements.length = 0;
    const data = await getMonthlyFinance(observed, f.ana, '2026-11', scope);
    expect(statements.length).toBe(queries);
    expect(data.result).toEqual(complete.result);
    expect(data.totalCents).toBe(complete.totalCents);
    expect(data.previousIncomes).toHaveLength(0);
  }
});
it('preserva nomes de categorias e números do snapshot de mês fechado', async () => {
  const f = await fixture(1);
  for (const userId of [f.ana, f.bruno])
    await saveIncome(db, userId, {
      month: '2026-11',
      amount: '1000,00',
      version: 0,
    });
  const transfer = await createSettlement(db, f.bruno, {
    month: '2026-11',
    amount: '0,50',
    creationKey: randomUUID(),
  });
  await transitionSettlement(db, f.ana, {
    month: '2026-11',
    id: transfer.id,
    action: 'confirm',
  });
  const before = await getMonthlyFinance(db, f.ana, '2026-11');
  await transitionMonth(db, f.ana, {
    month: '2026-11',
    action: 'close',
    fingerprint: monthFingerprint(before),
    acknowledged: true,
  });
  await saveCategory(db, f.ana, {
    id: f.category.id,
    name: 'Renomeada',
    color: '#286351',
  });
  const list = await getExpenseList(db, f.bruno, '2026-11', {});
  expect(list.period!.closedAt).not.toBeNull();
  expect(list.totalCents).toBe(before.totalCents);
  expect(
    list.displayCategories.find((category) => category.id === f.category.id)!
      .name,
  ).toBe(f.category.name);
});
