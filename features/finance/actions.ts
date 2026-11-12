'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import { getDb } from '@/db';
import { requireHousehold } from '@/features/household/queries';
import { consumeActionLimit } from '@/lib/security/action-rate-limit';
import {
  createExpense,
  deleteExpense,
  payExpense,
  FinanceError,
  saveIncome,
  setIncomeRedistribution,
  updateDefaultRule,
  updateExpense,
} from './service';

export type FinanceState = { error?: string; message?: string };
const failure = (error: unknown): FinanceState => ({
  error:
    error instanceof FinanceError
      ? error.message
      : error instanceof ZodError
        ? (error.issues[0]?.message ?? 'Confira os campos.')
        : 'Não foi possível salvar agora. Tente novamente em instantes.',
});
function expenseFields(form: FormData) {
  return {
    month: form.get('month'),
    description: form.get('description'),
    amount: form.get('amount'),
    dueDate: form.get('dueDate'),
    categoryId: form.get('categoryId'),
    paidByUserId: form.get('paidByUserId') || null,
    notes: form.get('notes') ?? '',
  };
}

export async function saveIncomeAction(
  _: FinanceState,
  form: FormData,
): Promise<FinanceState> {
  // Autorização fora do catch: redirecionamentos de sessão não são erros do formulário.
  const { user } = await requireHousehold();
  try {
    if (!(await consumeActionLimit(getDb(), `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto antes de salvar novamente.');
    await saveIncome(getDb(), user.id, {
      month: form.get('month'),
      amount: form.get('amount'),
      extra: form.get('extra') || '0',
      expectedAmount: form.get('expectedAmount')
        ? Number(form.get('expectedAmount'))
        : undefined,
      applyFuture: form.get('applyFuture') === 'on',
      version: Number(form.get('version')),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/casal', 'layout');
  return { message: 'Sua renda foi salva e o painel foi atualizado.' };
}

export async function createExpenseAction(
  _: FinanceState,
  form: FormData,
): Promise<FinanceState> {
  const { user } = await requireHousehold();
  let month: string;
  try {
    if (!(await consumeActionLimit(getDb(), `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto antes de salvar novamente.');
    const expense = await createExpense(getDb(), user.id, {
      ...expenseFields(form),
      creationKey: form.get('creationKey'),
    });
    month = expense.month.slice(0, 7);
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/casal', 'layout');
  redirect(`/casal/despesas?mes=${month}&salva=1`);
}

export async function updateExpenseAction(
  _: FinanceState,
  form: FormData,
): Promise<FinanceState> {
  const { user } = await requireHousehold();
  let month: string;
  try {
    if (!(await consumeActionLimit(getDb(), `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto antes de salvar novamente.');
    const expense = await updateExpense(getDb(), user.id, {
      ...expenseFields(form),
      id: form.get('id'),
      version: Number(form.get('version')),
    });
    month = expense.month.slice(0, 7);
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/casal', 'layout');
  redirect(`/casal/despesas?mes=${month}&salva=1`);
}

export async function deleteExpenseAction(
  _: FinanceState,
  form: FormData,
): Promise<FinanceState> {
  const { user } = await requireHousehold();
  const month = form.get('month');
  try {
    if (!(await consumeActionLimit(getDb(), `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto antes de tentar novamente.');
    await deleteExpense(getDb(), user.id, {
      month,
      id: form.get('id'),
      version: Number(form.get('version')),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/casal', 'layout');
  redirect(`/casal/despesas?mes=${month}&excluida=1`);
}

export async function saveRuleAction(
  _: FinanceState,
  form: FormData,
): Promise<FinanceState> {
  const { user } = await requireHousehold();
  try {
    if (!(await consumeActionLimit(getDb(), `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto antes de tentar novamente.');
    await updateDefaultRule(getDb(), user.id, {
      splitMode: form.get('splitMode'),
      sharePercent: form.get('sharePercent'),
      transferDay: Number(form.get('transferDay')),
      designatedPayerId: form.get('designatedPayerId') || null,
      tiebreakUserId: form.get('tiebreakUserId') || null,
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/casal', 'layout');
  return {
    message:
      'Combinado salvo. Meses que já têm lançamentos mantêm a regra anterior.',
  };
}

export async function redistributeIncomeAction(
  _: FinanceState,
  form: FormData,
): Promise<FinanceState> {
  const { user } = await requireHousehold();
  try {
    if (!(await consumeActionLimit(getDb(), `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto antes de tentar novamente.');
    await setIncomeRedistribution(getDb(), user.id, {
      month: form.get('month'),
      fingerprint: form.get('fingerprint'),
      enabled: form.get('enabled') === 'true',
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/casal', 'layout');
  return {
    message:
      form.get('enabled') === 'true'
        ? 'Redistribuição aplicada. O acerto do mês foi recalculado.'
        : 'A divisão original deste mês foi restaurada.',
  };
}

export async function payExpenseAction(
  _: FinanceState,
  form: FormData,
): Promise<FinanceState> {
  const { user } = await requireHousehold();
  try {
    if (!(await consumeActionLimit(getDb(), `finance:${user.id}`, 120, 60)))
      throw new FinanceError('Aguarde um minuto antes de tentar novamente.');
    await payExpense(getDb(), user.id, {
      month: form.get('month'),
      id: form.get('id'),
      version: Number(form.get('version')),
      paidByUserId: form.get('paidByUserId'),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/casal', 'layout');
  return { message: 'Pagamento confirmado. O acerto do mês foi atualizado.' };
}
