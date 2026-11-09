import { expect, it } from 'vitest';
import { createHouseholdSchema, acceptInviteSchema } from './schema';

const valid = {
  name: ' Nossa casa ',
  displayName: ' Ana ',
  splitMode: 'fixed',
  higherShareBps: 7000,
  transferDay: 25,
  consent: true,
};
it('normaliza nomes e exige concordância explícita antes de criar', () => {
  expect(createHouseholdSchema.parse(valid)).toMatchObject({
    name: 'Nossa casa',
    displayName: 'Ana',
  });
  for (const value of [false, undefined, 'true'])
    expect(
      createHouseholdSchema.safeParse({ ...valid, consent: value }).success,
    ).toBe(false);
});
it('valida percentual, dia, nomes e token', () => {
  for (const patch of [
    { higherShareBps: 10001 },
    { higherShareBps: 70.5 },
    { transferDay: 0 },
    { transferDay: 32 },
    { name: ' ' },
    { displayName: '' },
  ]) {
    expect(
      createHouseholdSchema.safeParse({ ...valid, ...patch }).success,
    ).toBe(false);
  }
  expect(
    acceptInviteSchema.safeParse({
      token: '../outro',
      displayName: 'Ana',
      consent: true,
    }).success,
  ).toBe(false);
});
