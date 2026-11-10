import { expect, it } from 'vitest';
import { suggestCapacity } from './suggest-capacity';

const members = [
  { userId: 'ana', incomeCents: 100000 },
  { userId: 'bruno', incomeCents: 300000 },
] as [
  { userId: string; incomeCents: number },
  { userId: string; incomeCents: number },
];

it('sugere que o par absorva a parte que ultrapassa a renda e preserva as cotas originais', () => {
  const shares = { ana: 150000, bruno: 150000 };
  expect(suggestCapacity(members, shares)).toMatchObject({
    contributions: { ana: 100000, bruno: 200000 },
    redistributedCents: 50000,
    uncoveredCents: 0,
  });
  expect(shares).toMatchObject({ ana: 150000, bruno: 150000 });
  expect(
    suggestCapacity([members[1], members[0]], shares)?.contributions,
  ).toMatchObject({ ana: 100000, bruno: 200000 });
});
it('limita a ajuda à renda do par e mostra o déficit restante', () => {
  expect(
    suggestCapacity(members, { ana: 250000, bruno: 250000 }),
  ).toMatchObject({
    contributions: { ana: 100000, bruno: 300000 },
    redistributedCents: 50000,
    uncoveredCents: 100000,
  });
});
it('não propõe mudança se as cotas couberem nas rendas, inclusive no limite', () => {
  expect(suggestCapacity(members, { ana: 100000, bruno: 300000 })).toBeNull();
  expect(suggestCapacity(members, { ana: 0, bruno: 0 })).toBeNull();
});
it('trata duas rendas zeradas e ambas as cotas acima da renda', () => {
  expect(
    suggestCapacity(
      members.map((member) => ({
        ...member,
        incomeCents: 0,
      })) as typeof members,
      { ana: 1, bruno: 2 },
    ),
  ).toMatchObject({
    contributions: { ana: 0, bruno: 0 },
    redistributedCents: 0,
    uncoveredCents: 3,
  });
  expect(
    suggestCapacity(members, { ana: 100001, bruno: 300001 })?.uncoveredCents,
  ).toBe(2);
});
it('redistribui o último centavo sem imprecisão e rejeita valores inválidos', () => {
  expect(
    suggestCapacity(members, { ana: 100001, bruno: 299999 })?.contributions,
  ).toMatchObject({ ana: 100000, bruno: 300000 });
  expect(() => suggestCapacity(members, { ana: -1, bruno: 0 })).toThrow();
  expect(() => suggestCapacity(members, { ana: 0.5, bruno: 0 })).toThrow();
  expect(() => suggestCapacity([members[0], members[0]], { ana: 0 })).toThrow();
  expect(() =>
    suggestCapacity(
      [{ ...members[0], incomeCents: Number.MAX_SAFE_INTEGER + 1 }, members[1]],
      { ana: 0, bruno: 0 },
    ),
  ).toThrow();
});
