import { describe, expect, it } from 'vitest';
import { currentMonth, inputMoney, shiftMonth, transferDate } from './month';
import { incomeSchema, monthSchema, ruleSchema } from './schema';
import { parseMoney } from '@/lib/money';

describe('competência e validação financeira', () => {
  it('usa a data de São Paulo ao virar o mês e o ano', () => {
    expect(currentMonth(new Date('2027-01-01T01:00:00Z'))).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });
  it('ajusta o dia de repasse ao último dia do mês', () => {
    expect(transferDate('2027-02', 31)).toBe('2027-02-28');
    expect(transferDate('2028-02', 31)).toBe('2028-02-29');
    expect(transferDate('2026-04', 31)).toBe('2026-04-30');
  });
  it('preserva centavos no formulário e admite renda zero explícita', () => {
    expect(parseMoney(inputMoney(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(
      incomeSchema.parse({ month: '2026-11', amount: '0,00', version: 0 })
        .amount,
    ).toBe(0);
    expect(
      incomeSchema.safeParse({ month: '2026-11', amount: '', version: 0 })
        .success,
    ).toBe(false);
    expect(
      incomeSchema.safeParse({ month: '2026-11', amount: '-1,00', version: 0 })
        .success,
    ).toBe(false);
  });
  it('não aceita competências inválidas ou datas em vez de competências', () => {
    for (const month of [
      '2026-13',
      '2026-00',
      '2026-11-01',
      '2026-1',
      '1999-12',
      '2200-01',
      'invalido',
    ])
      expect(monthSchema.safeParse(month).success).toBe(false);
  });
  it('converte percentuais para basis points sem arredondar dinheiro', () => {
    expect(
      ruleSchema.parse({
        splitMode: 'fixed',
        sharePercent: '70,50',
        transferDay: 31,
        designatedPayerId: null,
        tiebreakUserId: null,
      }).sharePercent,
    ).toBe(7050);
    expect(
      ruleSchema.safeParse({
        splitMode: 'fixed',
        sharePercent: '100,01',
        transferDay: 25,
        designatedPayerId: null,
        tiebreakUserId: null,
      }).success,
    ).toBe(false);
  });
});

it('valida valores, limite e identificadores únicos de rendas extras', () => {
  const entry = {
    id: '00000000-0000-4000-8000-000000000001',
    description: '',
    amount: '0,01',
  };
  const data = {
    month: '2026-11',
    amount: '0',
    version: 0,
    extraEntries: [entry],
  };
  expect(incomeSchema.parse(data).extraEntries![0]!.description).toBe(
    'Renda extra',
  );
  expect(
    incomeSchema.safeParse({ ...data, extraEntries: [entry, entry] }).success,
  ).toBe(false);
  expect(
    incomeSchema.safeParse({
      ...data,
      extraEntries: [{ ...entry, amount: '-1' }],
    }).success,
  ).toBe(false);
  expect(
    incomeSchema.safeParse({
      ...data,
      extraEntries: [{ ...entry, amount: '0' }],
    }).success,
  ).toBe(false);
  expect(
    incomeSchema.safeParse({
      ...data,
      extraEntries: Array.from({ length: 51 }, (_, i) => ({
        ...entry,
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      })),
    }).success,
  ).toBe(false);
});
