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
  setIncomeRedistribution,
  monthFingerprint,
  createSettlement,
  transitionSettlement,
  transitionMonth,
} from '@/features/finance/service';

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
async function fixture() {
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
  await createHousehold(db, ana, {
    name: 'Redistribuição',
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
  await saveIncome(db, ana, {
    month: '2026-11',
    amount: '1.000,00',
    version: 0,
  });
  await saveIncome(db, bruno, {
    month: '2026-11',
    amount: '3.000,00',
    version: 0,
  });
  const data = await getMonthlyFinance(db, ana, '2026-11');
  const expense = {
    month: '2026-11',
    description: 'Contas',
    amount: '3.000,00',
    dueDate: '2026-11-10',
    categoryId: data.categories[0]!.id,
    paidByUserId: bruno,
    notes: '',
    creationKey: randomUUID(),
  };
  await createExpense(db, ana, expense);
  return { ana, bruno, expense };
}
async function toggle(ana: string, enabled: boolean) {
  const data = await getMonthlyFinance(db, ana, '2026-11');
  await setIncomeRedistribution(db, ana, {
    month: data.month,
    fingerprint: monthFingerprint(data),
    enabled,
  });
}
it('persiste a redistribuição para as duas sessões, recalcula repasse, permite restaurar e não altera outros meses', async () => {
  const f = await fixture();
  const before = await getMonthlyFinance(db, f.ana, '2026-11');
  expect(before.incomeTotalCents).toBe(400000);
  expect(before.result!.shares[f.ana]).toBe(150000);
  await toggle(f.ana, true);
  const after = await getMonthlyFinance(db, f.bruno, '2026-11');
  expect(after.result!.shares).toEqual({ [f.ana]: 100000, [f.bruno]: 200000 });
  expect(after.result!.transfer?.amountCents).toBe(100000);
  expect(after.result!.paid).toEqual(before.result!.paid);
  expect(after.rule.splitMode).toBe('equal');
  expect((await getMonthlyFinance(db, f.ana, '2026-12')).period).toBeNull();
  await toggle(f.bruno, false);
  expect(
    (await getMonthlyFinance(db, f.ana, '2026-11')).result!.shares,
  ).toEqual(before.result!.shares);
});
it('rejeita sugestão desatualizada, casal externo e duas aplicações concorrentes', async () => {
  const f = await fixture();
  const other = await fixture();
  const data = await getMonthlyFinance(db, f.ana, '2026-11');
  const input = {
    month: data.month,
    fingerprint: monthFingerprint(data),
    enabled: true,
  };
  await expect(setIncomeRedistribution(db, other.ana, input)).rejects.toThrow(
    'mudaram',
  );
  const results = await Promise.allSettled([
    setIncomeRedistribution(db, f.ana, input),
    setIncomeRedistribution(db, f.bruno, input),
  ]);
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  await expect(setIncomeRedistribution(db, f.ana, input)).rejects.toThrow(
    'mudaram',
  );
});
it('bloqueia repasse pendente, desconta apenas o confirmado e congela o ajuste no fechamento', async () => {
  const f = await fixture();
  const settlement = await createSettlement(db, f.ana, {
    month: '2026-11',
    amount: '1.000,00',
    creationKey: randomUUID(),
  });
  await expect(toggle(f.ana, true)).rejects.toThrow('pendentes');
  await transitionSettlement(db, f.bruno, {
    month: '2026-11',
    id: settlement.id,
    action: 'confirm',
  });
  await toggle(f.ana, true);
  const data = await getMonthlyFinance(db, f.ana, '2026-11');
  expect(data.result!.transfer).toBeNull();
  await transitionMonth(db, f.ana, {
    month: data.month,
    action: 'close',
    fingerprint: monthFingerprint(data),
    acknowledged: true,
  });
  await expect(toggle(f.ana, false)).rejects.toThrow('fechado');
  const closed = await getMonthlyFinance(db, f.ana, '2026-11');
  expect(closed.result).toEqual(data.result);
  expect(closed.period!.snapshot!.data.redistributeByIncome).toBe(true);
});
it('recalcula somente o mês ajustado quando despesas mudam e mantém o déficit explícito', async () => {
  const f = await fixture();
  await toggle(f.ana, true);
  await createExpense(db, f.ana, {
    ...f.expense,
    amount: '2.000,00',
    paidByUserId: null,
    creationKey: randomUUID(),
  });
  const data = await getMonthlyFinance(db, f.ana, '2026-11');
  expect(data.capacitySuggestion!.uncoveredCents).toBe(100000);
  expect(data.result!.shares).toEqual({ [f.ana]: 200000, [f.bruno]: 300000 });
  expect(
    Object.values(data.result!.balances).reduce((sum, value) => sum + value, 0),
  ).toBe(data.unpaidCents);
});
