import { expect, it } from 'vitest';
import { calculate } from './calculate';
import { applyTransfers } from './apply-transfers';

const original = calculate(
  [
    { userId: 'ana', incomeCents: 700000 },
    { userId: 'bruno', incomeCents: 300000 },
  ],
  { mode: 'fixed', higherShareBps: 7000 },
  [{ amountCents: 400000, paidByUserId: 'ana' }],
);
it('desconta parciais confirmadas e preserva cotas e pagamentos', () => {
  const result = applyTransfers(original, [
    { fromUserId: 'bruno', toUserId: 'ana', amountCents: 50000 },
  ]);
  expect(result.transfer).toEqual({
    from: 'bruno',
    to: 'ana',
    amountCents: 70000,
  });
  expect(result.paid).toEqual(original.paid);
  expect(original.transfer!.amountCents).toBe(120000);
});
it('zera o saldo quitado e indica devolução quando o cálculo muda', () => {
  expect(
    applyTransfers(original, [
      { fromUserId: 'bruno', toUserId: 'ana', amountCents: 120000 },
    ]).transfer,
  ).toBeNull();
  expect(
    applyTransfers(original, [
      { fromUserId: 'bruno', toUserId: 'ana', amountCents: 120001 },
    ]).transfer,
  ).toEqual({ from: 'ana', to: 'bruno', amountCents: 1 });
});
it('preserva contas pendentes e rejeita membro externo', () => {
  const pending = calculate(
    [
      { userId: 'ana', incomeCents: 7 },
      { userId: 'bruno', incomeCents: 3 },
    ],
    { mode: 'fixed', higherShareBps: 7000 },
    [
      { amountCents: 80, paidByUserId: 'ana' },
      { amountCents: 20, paidByUserId: null },
    ],
  );
  const result = applyTransfers(pending, [
    { fromUserId: 'bruno', toUserId: 'ana', amountCents: 10 },
  ]);
  expect(result.transfer).toBeNull();
  expect(result.unpaidCents).toBe(20);
  expect(() =>
    applyTransfers(original, [
      { fromUserId: 'externo', toUserId: 'ana', amountCents: 1 },
    ]),
  ).toThrow();
});
