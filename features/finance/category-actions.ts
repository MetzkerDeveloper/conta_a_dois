'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { getDb } from '@/db';
import { requireHousehold } from '@/features/household/queries';
import { consumeActionLimit } from '@/lib/security/action-rate-limit';
import { FinanceError, saveCategory, setCategoryActive } from './service';
import { categoryStatusSchema } from './schema';

export type CategoryActionState = { error?: string; message?: string };
function failure(error: unknown): CategoryActionState {
  return {
    error:
      error instanceof FinanceError
        ? error.message
        : error instanceof ZodError
          ? (error.issues[0]?.message ?? 'Confira os campos.')
          : 'Não foi possível salvar a categoria. Tente novamente.',
  };
}

export async function saveCategoryAction(
  _: CategoryActionState,
  form: FormData,
): Promise<CategoryActionState> {
  const { user } = await requireHousehold();
  try {
    const db = getDb();
    if (!(await consumeActionLimit(db, `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto antes de salvar novamente.');
    await saveCategory(db, user.id, {
      id: form.get('id') || undefined,
      name: form.get('name'),
      color: form.get('color'),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/casal', 'layout');
  return { message: 'Categoria salva.' };
}

export async function toggleCategoryAction(
  _: CategoryActionState,
  form: FormData,
): Promise<CategoryActionState> {
  const { user } = await requireHousehold();
  try {
    const activeValue = form.get('active');
    if (activeValue !== 'true' && activeValue !== 'false')
      return { error: 'Ação de categoria inválida.' };
    const parsed = categoryStatusSchema.safeParse({
      id: form.get('id'),
      active: activeValue === 'true',
    });
    if (!parsed.success)
      return {
        error: parsed.error.issues[0]?.message ?? 'Categoria inválida.',
      };
    const db = getDb();
    if (!(await consumeActionLimit(db, `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto antes de salvar novamente.');
    await setCategoryActive(db, user.id, parsed.data);
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/casal', 'layout');
  return {
    message:
      form.get('active') === 'true'
        ? 'Categoria reativada.'
        : 'Categoria arquivada.',
  };
}
