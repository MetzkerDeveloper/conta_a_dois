'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { getDb } from '@/db';
import { requireHousehold } from '@/features/household/queries';
import { consumeActionLimit } from '@/lib/security/action-rate-limit';
import {
  FinanceError,
  generateRecurring,
  saveRecurring,
  transitionMonth,
} from './service';
import type { FinanceState } from './actions';

function failure(error: unknown): FinanceState {
  return {
    error:
      error instanceof FinanceError
        ? error.message
        : error instanceof ZodError
          ? error.issues[0]?.message
          : 'Não foi possível salvar. Tente novamente.',
  };
}
export async function generateRecurringAction(
  month: string,
): Promise<FinanceState> {
  const { user } = await requireHousehold();
  try {
    if (
      !(await consumeActionLimit(
        getDb(),
        `recurring:generate:${user.id}`,
        60,
        60,
      ))
    )
      return {};
    const count = await generateRecurring(getDb(), user.id, month);
    if (count) revalidatePath('/casal', 'layout');
    return count
      ? { message: `${count} conta(s) recorrente(s) adicionada(s) ao mês.` }
      : {};
  } catch (error) {
    return failure(error);
  }
}
export async function saveRecurringAction(
  _: FinanceState,
  form: FormData,
): Promise<FinanceState> {
  const { user } = await requireHousehold();
  try {
    if (!(await consumeActionLimit(getDb(), `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto para tentar novamente.');
    await saveRecurring(getDb(), user.id, {
      id: form.get('id') || undefined,
      version: Number(form.get('version')),
      creationKey: form.get('creationKey'),
      description: form.get('description'),
      amount: form.get('amount'),
      categoryId: form.get('categoryId'),
      dayOfMonth: Number(form.get('dayOfMonth')),
      startMonth: form.get('startMonth'),
      active: form.get('active') === 'on',
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/casal', 'layout');
  return {
    message: 'Recorrência salva. Os lançamentos já gerados foram preservados.',
  };
}
export async function monthAction(
  _: FinanceState,
  form: FormData,
): Promise<FinanceState> {
  const { user } = await requireHousehold();
  try {
    if (!(await consumeActionLimit(getDb(), `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto para tentar novamente.');
    await transitionMonth(getDb(), user.id, {
      action: form.get('action'),
      month: form.get('month'),
      fingerprint: form.get('fingerprint'),
      closedAt: form.get('closedAt'),
      acknowledged: form.get('acknowledged') === 'on',
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/casal', 'layout');
  return {
    message:
      form.get('action') === 'close'
        ? 'Mês fechado. Os números foram congelados.'
        : 'Mês reaberto. Os lançamentos podem ser corrigidos.',
  };
}
