import { expect, it } from 'vitest';
import { changePasswordSchema } from './change-password-schema';

const valid = {
  currentPassword: 'Atual-123',
  newPassword: 'Nova-senha-456',
  confirmation: 'Nova-senha-456',
};
it('exige senha atual, confirmação e uma nova senha diferente de 8 a 128 caracteres', () => {
  expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  for (const input of [
    { ...valid, currentPassword: '' },
    { ...valid, newPassword: 'curta', confirmation: 'curta' },
    { ...valid, newPassword: 'x'.repeat(129), confirmation: 'x'.repeat(129) },
    { ...valid, confirmation: 'Outra-senha-456' },
    {
      ...valid,
      newPassword: valid.currentPassword,
      confirmation: valid.currentPassword,
    },
  ])
    expect(changePasswordSchema.safeParse(input).success).toBe(false);
});
