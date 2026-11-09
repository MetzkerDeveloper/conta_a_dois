import { z } from 'zod';
import { parseMoney } from '@/lib/money';
import { categories } from './data';

export const moneyInput = z.string().transform((value, ctx) => {
  try {
    return parseMoney(value);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Use um valor como 1.234,56.' });
    return z.NEVER;
  }
});

export const expenseSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, 'Escreva uma descrição com pelo menos 2 letras.')
    .max(100),
  amount: moneyInput.pipe(
    z.number().int().positive('O valor deve ser maior que zero.'),
  ),
  dueDate: z.iso
    .date('Informe uma data válida.')
    .refine(
      (value) => value.startsWith('2026-11-'),
      'A demonstração usa novembro de 2026.',
    ),
  category: z
    .string()
    .refine((value) => categories.includes(value), 'Selecione uma categoria.'),
  paidByUserId: z.enum(['ana', 'bruno', 'pending']),
});
