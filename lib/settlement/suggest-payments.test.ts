import { describe, expect, it } from 'vitest';
import { calculate } from './calculate';
import { applyTransfers } from './apply-transfers';
import { suggestPayments } from './suggest-payments';

const members: Parameters<typeof calculate>[0] = [
  { userId: 'a', incomeCents: 70000 },
  { userId: 'b', incomeCents: 30000 },
];
const rule = { mode: 'proportional', higherShareBps: 7000 } as const;
const expense = (
  id: string,
  amountCents: number,
  paidByUserId: string | null = null,
) => ({ id, amountCents, paidByUserId });

describe('suggestPayments', () => {
  it('aproxima a divisão proporcional com contas inteiras e independe da ordem de entrada', () => {
    const expenses = [expense('small', 3000), expense('large', 7000)];
    const result = calculate(members, rule, expenses);
    expect(suggestPayments(result, expenses)).toEqual({
      large: 'a',
      small: 'b',
    });
    expect(suggestPayments(result, [...expenses].reverse())).toEqual(
      suggestPayments(result, expenses),
    );
  });

  it('considera pagamentos e repasses confirmados sem sugerir contas pagas', () => {
    const expenses = [expense('paid', 5000, 'a'), expense('pending', 5000)];
    const result = calculate(members, { ...rule, mode: 'equal' }, expenses);
    expect(suggestPayments(result, expenses)).toEqual({ pending: 'b' });
    const reconciled = applyTransfers(result, [
      { fromUserId: 'b', toUserId: 'a', amountCents: 5000 },
    ]);
    expect(suggestPayments(reconciled, expenses)).toEqual({ pending: 'a' });
  });

  it('respeita o pagador padrão e não altera o cálculo original', () => {
    const expenses = [expense('one', 7000), expense('two', 3000)];
    const result = calculate(members, rule, expenses);
    const original = structuredClone(result);
    expect(suggestPayments(result, expenses, 'b')).toEqual({
      one: 'b',
      two: 'b',
    });
    expect(result).toEqual(original);
  });

  it('mantém desempates determinísticos e centavos exatos', () => {
    const expenses = [
      expense('one', 1),
      expense('two', 1),
      expense('three', 1),
    ];
    const result = calculate(members, { ...rule, mode: 'equal' }, expenses);
    const suggestions = suggestPayments(result, expenses);
    expect(Object.values(suggestions).filter((id) => id === 'a')).toHaveLength(
      2,
    );
    expect(Object.values(suggestions).filter((id) => id === 'b')).toHaveLength(
      1,
    );
    expect(suggestPayments(result, [])).toEqual({});
  });
});
