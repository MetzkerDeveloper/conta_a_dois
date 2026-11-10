import { z } from 'zod';
import { parseMoney } from '@/lib/money';

export const monthSchema = z
  .string()
  .regex(
    /^(20|21)\d{2}-(0[1-9]|1[0-2])$/,
    'Escolha uma competência entre 2000 e 2199.',
  );
const amount = z
  .string()
  .max(30, 'Valor muito longo.')
  .transform((value, ctx) => {
    try {
      return parseMoney(value);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe um valor como 1.234,56.',
      });
      return z.NEVER;
    }
  });
export const incomeSchema = z.object({
  month: monthSchema,
  amount: amount.pipe(
    z.number().int().nonnegative('A renda não pode ser negativa.'),
  ),
  version: z.number().int().nonnegative(),
});
export const expenseSchema = z.object({
  month: monthSchema,
  description: z
    .string()
    .trim()
    .min(2, 'Descreva a despesa com pelo menos duas letras.')
    .max(120),
  amount: amount.pipe(
    z.number().int().positive('O valor deve ser maior que zero.'),
  ),
  dueDate: z.iso
    .date('Informe uma data válida.')
    .refine(
      (date) => /^(20|21)\d{2}-/.test(date),
      'Use uma data entre 2000 e 2199.',
    ),
  categoryId: z.uuid('Escolha uma categoria.'),
  paidByUserId: z.union([z.string().min(1).max(128), z.null()]),
  notes: z
    .string()
    .trim()
    .max(1000, 'Use até 1.000 caracteres nas observações.'),
});
export const createExpenseSchema = expenseSchema.extend({
  creationKey: z.uuid(),
});
export const updateExpenseSchema = expenseSchema.extend({
  id: z.uuid(),
  version: z.number().int().positive(),
});
export const deleteExpenseSchema = z.object({
  month: monthSchema,
  id: z.uuid(),
  version: z.number().int().positive(),
});
export const ruleSchema = z.object({
  splitMode: z.enum(['fixed', 'equal', 'proportional']),
  sharePercent: amount.pipe(
    z
      .number()
      .int()
      .min(0, 'Use um percentual de 0 a 100.')
      .max(10000, 'Use um percentual de 0 a 100.'),
  ),
  transferDay: z.number().int().min(1).max(31),
  tiebreakUserId: z.union([z.string().min(1).max(128), z.null()]),
  designatedPayerId: z.union([z.string().min(1).max(128), z.null()]),
});
export const createSettlementSchema = z.object({
  month: monthSchema,
  amount: expenseSchema.shape.amount,
  creationKey: z.uuid(),
});
export const settlementTransitionSchema = z.object({
  month: monthSchema,
  id: z.uuid(),
  action: z.enum(['confirm', 'cancel']),
});
export const recurringSchema = z.object({
  id: z.uuid().optional(),
  version: z.number().int().nonnegative(),
  creationKey: z.uuid(),
  description: expenseSchema.shape.description,
  amount: expenseSchema.shape.amount,
  categoryId: expenseSchema.shape.categoryId,
  dayOfMonth: z.number().int().min(1).max(31),
  startMonth: monthSchema,
  active: z.boolean(),
});
export const monthTransitionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('close'),
    month: monthSchema,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    acknowledged: z.literal(true, {
      error: 'Confirme que você conferiu os dados do mês.',
    }),
  }),
  z.object({
    action: z.literal('reopen'),
    month: monthSchema,
    closedAt: z.iso.datetime(),
    acknowledged: z.literal(true, { error: 'Confirme a reabertura do mês.' }),
  }),
]);

export const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, 'Informe o nome da categoria.').max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Escolha uma cor válida.'),
});
export const categoryStatusSchema = z.object({
  id: z.uuid(),
  active: z.boolean(),
});

export const redistributionSchema = z.object({
  month: monthSchema,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  enabled: z.boolean(),
});
