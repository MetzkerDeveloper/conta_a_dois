import { describe, expect, it } from 'vitest';
import {
  monthlyOutlook,
  reserveScenario,
  summarizeHistory,
} from './financial-history';

const members = [
  { userId: 'a', incomeCents: 70000 },
  { userId: 'b', incomeCents: 30000 },
];
const rule = { mode: 'proportional', higherShareBps: 7000 } as const;

describe('monthlyOutlook', () => {
  it('calcula a sobra após cotas incluindo todas as despesas', () => {
    const result = monthlyOutlook({
      members,
      rule,
      totalCents: 40000,
      redistribute: false,
    })!;
    expect(result.incomeCents).toBe(100000);
    expect(result.remainingCents).toBe(60000);
    expect(result.members.map((member) => member.remainingCents)).toEqual([
      42000, 18000,
    ]);
  });
  it('preserva cotas do snapshot e não recalcula o histórico com outra regra', () => {
    const result = monthlyOutlook({
      members,
      rule,
      totalCents: 40000,
      redistribute: false,
      frozenShares: { a: 20000, b: 20000 },
    })!;
    expect(result.members.map((member) => member.remainingCents)).toEqual([
      50000, 10000,
    ]);
  });
  it('aplica redistribuição somente quando ativa e mantém déficits', () => {
    const input = {
      members: [
        { userId: 'a', incomeCents: 90000 },
        { userId: 'b', incomeCents: 10000 },
      ],
      rule: { ...rule, mode: 'equal' as const },
      totalCents: 60000,
    };
    expect(
      monthlyOutlook({ ...input, redistribute: false })!.members.map(
        (member) => member.remainingCents,
      ),
    ).toEqual([60000, -20000]);
    expect(
      monthlyOutlook({ ...input, redistribute: true })!.members.map(
        (member) => member.remainingCents,
      ),
    ).toEqual([40000, 0]);
    expect(
      monthlyOutlook({ ...input, totalCents: 120000, redistribute: true })!
        .remainingCents,
    ).toBe(-20000);
  });
  it('admite renda zero e exige dois membros', () => {
    expect(
      monthlyOutlook({ members: [], rule, totalCents: 0, redistribute: false }),
    ).toBeNull();
    expect(
      monthlyOutlook({
        members: members.map((member) => ({ ...member, incomeCents: 0 })),
        rule,
        totalCents: 1,
        redistribute: false,
      })!.remainingCents,
    ).toBe(-1);
  });
});

describe('indicadores e reserva', () => {
  it('soma centavos com bigint e calcula médias inteiras', () => {
    expect(
      summarizeHistory([
        { incomeCents: 100, expenseCents: 101, remainingCents: -1 },
        { incomeCents: 103, expenseCents: 100, remainingCents: 3 },
      ]),
    ).toMatchObject({
      incomeCents: 203,
      expenseCents: 201,
      remainingCents: 2,
      averageExpenseCents: 100,
      averageRemainingCents: 1,
      count: 2,
    });
    expect(summarizeHistory([])).toMatchObject({
      count: 0,
      averageRemainingCents: 0,
    });
  });
  it('simula sem rendimento, arredonda contribuição para baixo e prazo para cima', () => {
    expect(reserveScenario(1001, 50, 10000)).toEqual({
      contributionCents: 500,
      annualCents: 6000,
      targetCents: 60000,
      monthsToTarget: 120,
    });
    expect(reserveScenario(300, 100, 100)).toMatchObject({ monthsToTarget: 2 });
    expect(reserveScenario(-1, 50, 100)).toMatchObject({
      contributionCents: 0,
      monthsToTarget: null,
    });
    expect(reserveScenario(100, 0, 100)).toMatchObject({
      contributionCents: 0,
      monthsToTarget: null,
    });
  });
  it('rejeita overflow e percentuais inválidos', () => {
    expect(() => reserveScenario(Number.MAX_SAFE_INTEGER, 100, 100)).toThrow(
      'limite seguro',
    );
    expect(() => reserveScenario(100, 101, 100)).toThrow('inválido');
    expect(() =>
      summarizeHistory([
        {
          incomeCents: Number.MAX_SAFE_INTEGER,
          expenseCents: 0,
          remainingCents: Number.MAX_SAFE_INTEGER,
        },
        { incomeCents: 1, expenseCents: 0, remainingCents: 1 },
      ]),
    ).toThrow('limite seguro');
  });
});
