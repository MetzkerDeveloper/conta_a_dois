import { z } from 'zod';

export const PRIVACY_VERSION = '2026-11-09';
export const createHouseholdSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Dê um nome ao espaço de vocês.')
    .max(80, 'Use até 80 caracteres.'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Informe como quer ser chamado(a).')
    .max(60, 'Use até 60 caracteres.'),
  splitMode: z.enum(['fixed', 'equal', 'proportional']),
  higherShareBps: z.number().int().min(0).max(10000),
  transferDay: z.number().int().min(1).max(31),
  consent: z.literal(true, {
    error: 'Leia e aceite a política de privacidade para continuar.',
  }),
});
export const acceptInviteSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Este convite não é válido.'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Informe como quer ser chamado(a).')
    .max(60),
  consent: z.literal(true, {
    error: 'Leia e aceite a política de privacidade para continuar.',
  }),
});
