import { z } from 'zod';

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Informe sua senha atual.')
      .max(128, 'Use até 128 caracteres.'),
    newPassword: z
      .string()
      .min(8, 'Use pelo menos 8 caracteres.')
      .max(128, 'Use até 128 caracteres.'),
    confirmation: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((value) => value.newPassword === value.confirmation, {
    path: ['confirmation'],
    message: 'As senhas devem ser iguais.',
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ['newPassword'],
    message: 'Escolha uma senha diferente da atual.',
  });
