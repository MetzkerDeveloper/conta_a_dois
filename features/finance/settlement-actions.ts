'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { getDb } from '@/db';
import { requireHousehold } from '@/features/household/queries';
import { consumeActionLimit } from '@/lib/security/action-rate-limit';
import {
  createSettlement,
  transitionSettlement,
  FinanceError,
} from './service';
import type { FinanceState } from './actions';

export async function settlementAction(
  _: FinanceState,
  form: FormData,
): Promise<FinanceState> {
  const { user } = await requireHousehold();
  const action = form.get('action');
  try {
    if (!(await consumeActionLimit(getDb(), `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto antes de tentar novamente.');
    if (action === 'create')
      await createSettlement(getDb(), user.id, {
        month: form.get('month'),
        amount: form.get('amount'),
        creationKey: form.get('creationKey'),
      });
    else
      await transitionSettlement(getDb(), user.id, {
        month: form.get('month'),
        id: form.get('id'),
        action,
      });
  } catch (error) {
    return {
      error:
        error instanceof FinanceError
          ? error.message
          : error instanceof ZodError
            ? error.issues[0]?.message
            : 'Não foi possível salvar o repasse. Tente novamente.',
    };
  }
  revalidatePath('/casal', 'layout');
  return {
    message:
      action === 'create'
        ? 'Envio registrado. Aguarde a confirmação do destinatário.'
        : action === 'confirm'
          ? 'Recebimento confirmado. O saldo foi atualizado.'
          : 'Registro cancelado. Nenhum valor foi descontado.',
  };
}
