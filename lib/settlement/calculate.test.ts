import { describe, expect, it } from 'vitest';
import { calculate } from './calculate';
import type { Member, Rule } from './types';

const members: [Member, Member] = [
  { userId: 'ana', incomeCents: 700000 },
  { userId: 'bruno', incomeCents: 300000 },
];
const rule: Rule = { mode: 'fixed', higherShareBps: 7000 };
const expense = (amountCents: number, paidByUserId: string | null = 'ana') => ({
  amountCents,
  paidByUserId,
});

describe('calculate', () => {
  it('calcula 70/30 com pagador único', () => {
    const result = calculate(members, rule, [expense(400000)]);
    expect(result.shares).toEqual({ ana: 280000, bruno: 120000 });
    expect(result.balances).toEqual({ ana: -120000, bruno: 120000 });
    expect(result.transfer).toEqual({
      from: 'bruno',
      to: 'ana',
      amountCents: 120000,
    });
  });
  it('compensa os dois pagadores conforme o exemplo', () => {
    expect(
      calculate(members, rule, [expense(100000), expense(300000, 'bruno')])
        .transfer,
    ).toEqual({ from: 'ana', to: 'bruno', amountCents: 180000 });
  });
  it.each([
    ['equal', 200000, 200000],
    ['proportional', 280000, 120000],
  ] as const)('divide no modo %s', (mode, ana, bruno) => {
    expect(
      calculate(members, { ...rule, mode }, [expense(400000)]).shares,
    ).toEqual({ ana, bruno });
  });
  it('usa a renda proporcional sem truncar para basis points', () => {
    expect(
      calculate(
        [
          { userId: 'ana', incomeCents: 2 },
          { userId: 'bruno', incomeCents: 1 },
        ],
        { ...rule, mode: 'proportional' },
        [expense(10000)],
      ).shares,
    ).toEqual({ ana: 6667, bruno: 3333 });
  });
  const tied: [Member, Member] = members.map((m) => ({
    ...m,
    incomeCents: 100,
  })) as [Member, Member];
  it('divide empate sem desempate em partes iguais', () => {
    expect(calculate(tied, rule, [expense(100)]).shares).toEqual({
      ana: 50,
      bruno: 50,
    });
  });
  it('aplica desempate configurado', () => {
    expect(
      calculate(tied, { ...rule, tiebreakUserId: 'bruno' }, [expense(100)])
        .shares,
    ).toEqual({ bruno: 70, ana: 30 });
  });
  it('destina o residual à segunda cota e mantém a soma exata', () => {
    expect(calculate(members, rule, [expense(105)]).shares).toEqual({
      ana: 74,
      bruno: 31,
    });
  });
  it('é estável ao inverter os membros empatados', () => {
    expect(calculate(tied, rule, [expense(1)]).shares).toEqual(
      calculate([tied[1], tied[0]], rule, [expense(1)]).shares,
    );
  });
  it('não sugere repasse quando ninguém pagou', () => {
    const result = calculate(members, rule, [expense(100, null)]);
    expect(result.unpaidCents).toBe(100);
    expect(result.transfer).toBeNull();
    expect(Object.values(result.balances).reduce((a, b) => a + b)).toBe(100);
  });
  it('limita o repasse ao crédito já financiado quando há despesas pendentes', () => {
    const result = calculate(members, rule, [expense(80), expense(20, null)]);
    expect(result.transfer).toEqual({
      from: 'bruno',
      to: 'ana',
      amountCents: 10,
    });
    expect(result.unpaidCents).toBe(20);
  });
  it('aceita total zero e renda proporcional zero', () => {
    expect(calculate(members, rule, []).transfer).toBeNull();
    const zero = tied.map((m) => ({ ...m, incomeCents: 0 })) as [
      Member,
      Member,
    ];
    expect(
      calculate(zero, { ...rule, mode: 'proportional' }, [expense(100)]).shares,
    ).toEqual({ ana: 50, bruno: 50 });
  });
  it.each([0, 10000])('aceita percentual extremo %i', (higherShareBps) => {
    expect(
      calculate(members, { ...rule, higherShareBps }, [expense(10000)]).shares,
    ).toEqual({ ana: higherShareBps, bruno: 10000 - higherShareBps });
  });
  it('evita imprecisão em produtos maiores que o limite de number', () => {
    expect(
      calculate(members, rule, [expense(9000000000000001)]).shares,
    ).toEqual({ ana: 6300000000000001, bruno: 2700000000000000 });
  });
  it('rejeita pagadores externos, frações, negativos e totais inseguros', () => {
    for (const invalid of [
      expense(10, 'externo'),
      expense(1.5),
      expense(-1),
      expense(0),
    ]) {
      expect(() => calculate(members, rule, [invalid])).toThrow();
    }
    expect(() =>
      calculate(members, rule, [expense(Number.MAX_SAFE_INTEGER), expense(1)]),
    ).toThrow();
    expect(() =>
      calculate(members, { ...rule, higherShareBps: 10001 }, []),
    ).toThrow();
    expect(() =>
      calculate(members, { ...rule, tiebreakUserId: 'externo' }, []),
    ).toThrow();
    expect(() => calculate([members[0], members[0]], rule, [])).toThrow();
  });
});
