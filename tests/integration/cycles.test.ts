import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
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
  saveRecurring,
  getRecurring,
  generateRecurring,
  getMonthlyFinance,
  saveIncome,
  updateExpense,
  deleteExpense,
  createSettlement,
  transitionSettlement,
  transitionMonth,
  monthFingerprint,
} from '@/features/finance/service';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Use um banco de teste isolado terminado em _test.');
const pool = new Pool({ connectionString: url, max: 4 });
const db = drizzle({ client: pool, schema });
beforeAll(async () => {
  await migrate(db, { migrationsFolder: './db/migrations' });
});
afterAll(async () => {
  await pool.end();
});
async function fixture() {
  const ana = randomUUID(),
    bruno = randomUUID();
  await db
    .insert(schema.user)
    .values(
      [ana, bruno].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
        emailVerified: true,
      })),
    );
  await createHousehold(db, ana, {
    name: 'Ciclos',
    displayName: 'Ana',
    splitMode: 'fixed',
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
  const data = await getMonthlyFinance(db, ana, '2026-11');
  return {
    ana,
    bruno,
    template: {
      description: 'Internet',
      amount: '100,00',
      categoryId: data.categories[0]!.id,
      dayOfMonth: 31,
      startMonth: '2026-11',
      active: true,
      version: 0,
      creationKey: randomUUID(),
    },
  };
}
it('gera uma ocorrência por mês, ajusta o dia, preserva exclusão e respeita pausa/edição', async () => {
  const f = await fixture();
  const template = { ...f.template, startMonth: '2027-02' };
  const id = await saveRecurring(db, f.ana, template);
  await Promise.all([
    generateRecurring(db, f.ana, '2027-02'),
    generateRecurring(db, f.bruno, '2027-02'),
  ]);
  let data = await getMonthlyFinance(db, f.ana, '2027-02');
  expect(data.expenses).toHaveLength(1);
  expect(data.expenses[0]!.dueDate).toBe('2027-02-28');
  expect(data.expenses[0]!.paidByUserId).toBeNull();
  await deleteExpense(db, f.ana, {
    month: '2027-02',
    id: data.expenses[0]!.id,
    version: 1,
  });
  expect(await generateRecurring(db, f.ana, '2027-02')).toBe(0);
  await saveRecurring(db, f.ana, {
    ...template,
    id,
    version: 1,
    active: false,
  });
  expect(await generateRecurring(db, f.ana, '2027-03')).toBe(0);
  await saveRecurring(db, f.bruno, {
    ...template,
    id,
    version: 2,
    amount: '200,00',
  });
  expect(await generateRecurring(db, f.ana, '2027-03')).toBe(1);
  data = await getMonthlyFinance(db, f.ana, '2027-03');
  expect(data.expenses[0]!.amountCents).toBe(20000);
  expect((await getMonthlyFinance(db, f.ana, '2027-02')).expenses).toHaveLength(
    0,
  );
});
it('exige pendências resolvidas, congela o mês e libera correções somente após reabrir', async () => {
  const f = await fixture();
  await saveRecurring(db, f.ana, f.template);
  const close = async (fingerprint?: string) => {
    const data = await getMonthlyFinance(db, f.ana, '2026-11');
    return transitionMonth(db, f.ana, {
      action: 'close',
      month: '2026-11',
      acknowledged: true,
      fingerprint: fingerprint ?? monthFingerprint(data),
    });
  };
  await expect(close()).rejects.toThrow('rendas');
  await saveIncome(db, f.ana, {
    month: '2026-11',
    amount: '7.000,00',
    version: 0,
  });
  await saveIncome(db, f.bruno, {
    month: '2026-11',
    amount: '3.000,00',
    version: 0,
  });
  await expect(close()).rejects.toThrow('contas a pagar');
  let data = await getMonthlyFinance(db, f.ana, '2026-11');
  const bill = data.expenses[0]!;
  const edit = {
    month: '2026-11',
    id: bill.id,
    version: 1,
    description: bill.description,
    amount: '100,00',
    dueDate: bill.dueDate,
    categoryId: bill.categoryId,
    paidByUserId: f.ana,
    notes: '',
  };
  await updateExpense(db, f.ana, edit);
  await expect(close()).rejects.toThrow('repasses');
  const transfer = await createSettlement(db, f.bruno, {
    month: '2026-11',
    amount: '30,00',
    creationKey: randomUUID(),
  });
  await expect(close()).rejects.toThrow('repasses');
  await transitionSettlement(db, f.ana, {
    month: '2026-11',
    id: transfer.id,
    action: 'confirm',
  });
  const stale = monthFingerprint(await getMonthlyFinance(db, f.ana, '2026-11'));
  await saveIncome(db, f.ana, {
    month: '2026-11',
    amount: '7.000,00',
    version: 1,
  });
  await expect(close(stale)).rejects.toThrow('mudaram');
  await close();
  data = await getMonthlyFinance(db, f.ana, '2026-11');
  expect(data.period!.snapshot!.totalCents).toBe(10000);
  expect(data.period!.snapshot!.result.transfer).toBeNull();
  await expect(
    updateExpense(db, f.ana, { ...edit, version: 2, amount: '200,00' }),
  ).rejects.toThrow('fechado');
  await expect(
    saveIncome(db, f.ana, { month: '2026-11', amount: '1,00', version: 2 }),
  ).rejects.toThrow('fechado');
  expect(await generateRecurring(db, f.ana, '2026-11')).toBe(0);
  await transitionMonth(db, f.bruno, {
    action: 'reopen',
    month: '2026-11',
    acknowledged: true,
    closedAt: data.period!.closedAt!.toISOString(),
  });
  await updateExpense(db, f.ana, { ...edit, version: 2, amount: '200,00' });
  data = await getMonthlyFinance(db, f.ana, '2026-11');
  expect(data.totalCents).toBe(20000);
  expect(data.period!.closedAt).toBeNull();
  expect(data.rule.higherShareBps).toBe(7000);
});
it('não expõe nem altera recorrências ou fechamento de outro casal', async () => {
  const f = await fixture(),
    other = await fixture();
  const id = await saveRecurring(db, f.ana, f.template);
  expect(await getRecurring(db, other.ana)).toHaveLength(0);
  await expect(
    saveRecurring(db, other.ana, { ...other.template, id, version: 1 }),
  ).rejects.toThrow('seu casal');
  expect(await generateRecurring(db, other.ana, '2026-11')).toBe(0);
  await expect(
    transitionMonth(db, other.ana, {
      action: 'reopen',
      month: '2026-11',
      acknowledged: true,
      closedAt: new Date().toISOString(),
    }),
  ).rejects.toThrow('estado do mês');
});
