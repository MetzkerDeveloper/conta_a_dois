import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
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
  createSettlement,
  transitionSettlement,
  getMonthlyFinance,
  saveIncome,
} from '@/features/finance/service';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Use um banco isolado terminado em _test.');
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
  const household = await createHousehold(db, ana, {
    name: 'Repasses',
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
  await saveIncome(db, ana, {
    month: '2026-11',
    amount: '7.000,00',
    version: 0,
  });
  await saveIncome(db, bruno, {
    month: '2026-11',
    amount: '3.000,00',
    version: 0,
  });
  const data = await getMonthlyFinance(db, ana, '2026-11');
  await createExpense(db, ana, {
    month: '2026-11',
    description: 'Aluguel',
    amount: '4.000,00',
    dueDate: '2026-11-25',
    categoryId: data.categories[0]!.id,
    paidByUserId: ana,
    notes: '',
    creationKey: randomUUID(),
  });
  return {
    ana,
    bruno,
    household,
    input: { month: '2026-11', amount: '500,00', creationKey: randomUUID() },
  };
}
it('mantém pendente no saldo, confirma só pelo destinatário e não desconta duas vezes', async () => {
  const f = await fixture();
  const pending = await createSettlement(db, f.bruno, f.input);
  expect(
    (await getMonthlyFinance(db, f.ana, '2026-11')).result!.transfer!
      .amountCents,
  ).toBe(120000);
  expect((await createSettlement(db, f.bruno, f.input)).id).toBe(pending.id);
  await expect(
    transitionSettlement(db, f.bruno, {
      month: '2026-11',
      id: pending.id,
      action: 'confirm',
    }),
  ).rejects.toThrow('quem recebe');
  const command = { month: '2026-11', id: pending.id, action: 'confirm' };
  await transitionSettlement(db, f.ana, command);
  await transitionSettlement(db, f.ana, command);
  expect(
    (await getMonthlyFinance(db, f.bruno, '2026-11')).result!.transfer!
      .amountCents,
  ).toBe(70000);
  const rest = await createSettlement(db, f.bruno, {
    ...f.input,
    amount: '700,00',
    creationKey: randomUUID(),
  });
  await transitionSettlement(db, f.ana, { ...command, id: rest.id });
  expect(
    (await getMonthlyFinance(db, f.bruno, '2026-11')).result!.transfer,
  ).toBeNull();
});
it('limita o valor, identifica o devedor no servidor e serializa registros concorrentes', async () => {
  const f = await fixture();
  await expect(createSettlement(db, f.ana, f.input)).rejects.toThrow(
    'quem tem valor',
  );
  await expect(
    createSettlement(db, f.bruno, { ...f.input, amount: '1.200,01' }),
  ).rejects.toThrow('ultrapassa');
  const results = await Promise.allSettled([
    createSettlement(db, f.bruno, f.input),
    createSettlement(db, f.bruno, { ...f.input, creationKey: randomUUID() }),
  ]);
  expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
});
it('isola casais, permite cancelar pendente e bloqueia alterações em mês fechado', async () => {
  const f = await fixture(),
    other = await fixture();
  const pending = await createSettlement(db, f.bruno, f.input);
  await expect(
    transitionSettlement(db, other.ana, {
      month: '2026-11',
      id: pending.id,
      action: 'confirm',
    }),
  ).rejects.toThrow('seu casal');
  expect(
    (await getMonthlyFinance(db, other.ana, '2026-11')).settlements,
  ).toHaveLength(0);
  await transitionSettlement(db, f.bruno, {
    month: '2026-11',
    id: pending.id,
    action: 'cancel',
  });
  expect(
    (await getMonthlyFinance(db, f.ana, '2026-11')).result!.transfer!
      .amountCents,
  ).toBe(120000);
  const next = await createSettlement(db, f.bruno, {
    ...f.input,
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
    transitionSettlement(db, f.ana, {
      month: '2026-11',
      id: next.id,
      action: 'confirm',
    }),
  ).rejects.toThrow('fechado');
});
