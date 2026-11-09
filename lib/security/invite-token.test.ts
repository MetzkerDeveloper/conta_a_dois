import { expect, it } from 'vitest';
import {
  createInviteToken,
  hashInviteToken,
  isInviteToken,
} from './invite-token';
import { safeReturnPath } from './redirect';

it('gera tokens aleatórios de 256 bits e armazena somente o hash', () => {
  const token = createInviteToken();
  expect(isInviteToken(token)).toBe(true);
  expect(createInviteToken()).not.toBe(token);
  expect(hashInviteToken(token)).toMatch(/^[a-f0-9]{64}$/);
  expect(hashInviteToken(token)).not.toBe(token);
  expect(hashInviteToken(token)).toBe(hashInviteToken(token));
});
it('só permite retorno para o casal ou um convite válido', () => {
  const path = `/convite/${createInviteToken()}`;
  expect(safeReturnPath(path)).toBe(path);
  for (const value of [
    'https://fora.test',
    '//fora.test',
    '/\\fora.test',
    '/casal?next=fora',
    '/convite/invalido',
    null,
    ['/casal'],
  ]) {
    expect(safeReturnPath(value)).toBe('/casal');
  }
});
