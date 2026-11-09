import { expect, it } from 'vitest';
import { formatMoney, parseMoney } from './money';

it.each([
  ['1.234,56', 123456],
  ['0,01', 1],
  ['10', 1000],
  ['12,5', 1250],
  ['-0,01', -1],
])('converte %s para centavos', (text, cents) => {
  expect(parseMoney(text)).toBe(cents);
});
it.each(['1.23', '1,234', '', 'abc', '1e3', '9007199254740992'])(
  'rejeita entrada inválida %s',
  (text) => {
    expect(() => parseMoney(text)).toThrow();
  },
);
it.each([
  0,
  1,
  -1,
  123456,
  -123456,
  Number.MAX_SAFE_INTEGER,
  -Number.MAX_SAFE_INTEGER,
])('formata e recupera %i sem perder centavos', (cents) => {
  expect(
    parseMoney(formatMoney(cents).replace('R$', '').replace(/\s/g, '')),
  ).toBe(cents);
});
