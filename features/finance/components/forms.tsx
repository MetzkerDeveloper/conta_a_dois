'use client';

import Link from 'next/link';
import { useActionState, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import {
  createExpenseAction,
  deleteExpenseAction,
  saveIncomeAction,
  saveRuleAction,
  updateExpenseAction,
} from '../actions';
import { inputMoney, monthLabel } from '../month';
import type { MonthlyFinance } from '../service';
import { formatMoney } from '@/lib/money';
import { useHydrated } from '@/lib/use-hydrated';
import { ExtraIncomeFields } from './extra-income-fields';

type Member = MonthlyFinance['members'][number];
type Expense = MonthlyFinance['expenses'][number];
function Feedback({ state }: { state: { error?: string; message?: string } }) {
  return (
    <>
      {state.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="notice" role="status">
          {state.message}
        </p>
      )}
    </>
  );
}

export function IncomeForm({
  month,
  income,
  closed,
}: {
  month: string;
  income?: MonthlyFinance['incomes'][number];
  closed: boolean;
}) {
  const [state, action, pending] = useActionState(saveIncomeAction, {});
  return (
    <form action={action} className="income-form">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="version" value={income?.version ?? 0} />
      <input
        type="hidden"
        name="expectedAmount"
        value={income?.amountCents ?? ''}
      />
      <label htmlFor="income-amount">Sua renda líquida (R$)</label>
      <input
        id="income-amount"
        name="amount"
        inputMode="decimal"
        maxLength={30}
        defaultValue={
          income ? inputMoney(income.amountCents - income.extraCents) : ''
        }
        placeholder="0,00"
        required
        disabled={closed}
      />
      <p className="form-note muted">
        Use o valor depois dos descontos. Se não houve renda, informe 0,00. Só
        você pode alterar sua renda.
      </p>
      <ExtraIncomeFields
        entries={income?.extraEntries ?? []}
        month={month}
        disabled={closed || pending}
      />
      <label>
        <input type="checkbox" name="applyFuture" disabled={closed} /> Usar a
        renda líquida também nos próximos meses
      </label>
      <p className="form-note muted">
        A primeira renda é reaproveitada automaticamente. Nas edições, deixe
        desmarcado para alterar somente este mês. Meses já iniciados mantêm os
        valores registrados.
      </p>
      <Feedback state={state} />
      <button
        className="button primary"
        type="submit"
        disabled={pending || closed}
      >
        {pending ? 'Salvando…' : 'Salvar minha renda'}
      </button>
    </form>
  );
}

export function ExpenseForm({
  month,
  members,
  categories,
  expense,
  creationKey,
  designatedPayerId,
}: {
  month: string;
  members: Member[];
  categories: MonthlyFinance['categories'];
  expense?: Expense;
  creationKey?: string;
  designatedPayerId: string | null;
}) {
  const [state, action, pending] = useActionState(
    expense ? updateExpenseAction : createExpenseAction,
    {},
  );
  return (
    <form action={action} className="real-expense-form">
      <input type="hidden" name="month" value={month} />
      {expense ? (
        <>
          <input type="hidden" name="id" value={expense.id} />
          <input type="hidden" name="version" value={expense.version} />
        </>
      ) : (
        <input type="hidden" name="creationKey" value={creationKey} />
      )}
      <label htmlFor="expense-description">Descrição</label>
      <input
        id="expense-description"
        name="description"
        defaultValue={expense?.description}
        minLength={2}
        maxLength={120}
        placeholder="Ex.: compras da semana"
        required
      />
      <div className="form-grid">
        <div>
          <label htmlFor="expense-amount">Valor (R$)</label>
          <input
            id="expense-amount"
            name="amount"
            inputMode="decimal"
            maxLength={30}
            defaultValue={expense ? inputMoney(expense.amountCents) : ''}
            placeholder="0,00"
            required
          />
        </div>
        <div>
          <label htmlFor="expense-due">Vencimento</label>
          <input
            id="expense-due"
            name="dueDate"
            type="date"
            min="2000-01-01"
            max="2199-12-31"
            defaultValue={expense?.dueDate ?? `${month}-25`}
            required
          />
        </div>
      </div>
      <label htmlFor="expense-category">Categoria</label>
      <select
        id="expense-category"
        name="categoryId"
        defaultValue={
          expense?.categoryId ??
          categories.find((category) => category.name === 'Outros')?.id
        }
        required
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
            {!category.active ? ' (arquivada)' : ''}
          </option>
        ))}
      </select>
      <label htmlFor="expense-payer">Quem pagou?</label>
      <select
        id="expense-payer"
        name="paidByUserId"
        defaultValue={
          expense ? (expense.paidByUserId ?? '') : (designatedPayerId ?? '')
        }
      >
        <option value="">Ainda não foi paga</option>
        {members.map((member) => (
          <option value={member.userId} key={member.userId}>
            {member.displayName}
          </option>
        ))}
      </select>
      {!expense && designatedPayerId && (
        <p className="form-note muted">
          O pagador responsável foi selecionado. Se a conta ainda não foi paga,
          mude para “Ainda não foi paga”.
        </p>
      )}
      <label htmlFor="expense-notes">Observações (opcional)</label>
      <textarea
        id="expense-notes"
        name="notes"
        defaultValue={expense?.notes ?? ''}
        maxLength={1000}
        rows={3}
      />
      <p className="form-note muted">
        Esta despesa entra na competência de {monthLabel(month)}, mesmo que o
        vencimento seja em outro mês.
      </p>
      <Feedback state={state} />
      <div className="form-actions">
        <Link
          href={`/casal/despesas?mes=${month}`}
          className="button secondary"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          className="button primary"
          disabled={pending || categories.length === 0}
        >
          {pending
            ? 'Salvando…'
            : expense
              ? 'Salvar alterações'
              : 'Salvar despesa'}
        </button>
      </div>
    </form>
  );
}

export function DeleteExpense({
  expense,
  month,
}: {
  expense: Expense;
  month: string;
}) {
  const hydrated = useHydrated();
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(deleteExpenseAction, {});
  return (
    <>
      <button
        className="icon-button delete-button"
        type="button"
        aria-label={`Excluir ${expense.description}`}
        disabled={!hydrated}
        onClick={() => ref.current?.showModal()}
      >
        <Trash2 size={16} />
      </button>
      <dialog
        ref={ref}
        className="expense-dialog"
        aria-labelledby={`delete-title-${expense.id}`}
      >
        <div className="section-heading">
          <h2 id={`delete-title-${expense.id}`}>Excluir esta despesa?</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Cancelar exclusão"
            disabled={pending}
            onClick={() => ref.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          {expense.description} · {formatMoney(expense.amountCents)}
        </p>
        <p className="form-note muted">
          Ela será removida do mês e o painel será recalculado. Esta ação não
          pode ser desfeita.
        </p>
        <form action={action}>
          <input type="hidden" name="id" value={expense.id} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="version" value={expense.version} />
          <Feedback state={state} />
          <button className="button danger" type="submit" disabled={pending}>
            {pending ? 'Excluindo…' : 'Confirmar exclusão'}
          </button>
        </form>
      </dialog>
    </>
  );
}

export function RuleForm({
  household,
  members,
}: {
  household: MonthlyFinance['household'];
  members: Member[];
}) {
  const [state, action, pending] = useActionState(saveRuleAction, {});
  return (
    <form action={action}>
      <label htmlFor="rule-mode">Como dividir as despesas?</label>
      <select
        id="rule-mode"
        name="splitMode"
        defaultValue={household.splitMode}
      >
        <option value="fixed">Percentual fixo</option>
        <option value="equal">Igualmente · 50/50</option>
        <option value="proportional">Proporcional às rendas</option>
      </select>
      <label htmlFor="rule-share">Percentual de quem tem a maior renda</label>
      <input
        id="rule-share"
        name="sharePercent"
        inputMode="decimal"
        defaultValue={inputMoney(household.higherShareBps)}
        required
      />
      <p className="form-note muted">
        De 0 a 100. Ex.: 70 ou 70,50. Usado apenas na divisão por percentual
        fixo.
      </p>
      <label htmlFor="rule-tiebreak">Se as rendas forem iguais</label>
      <select
        id="rule-tiebreak"
        name="tiebreakUserId"
        defaultValue={household.tiebreakUserId ?? ''}
      >
        <option value="">Dividir 50/50</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            Aplicar o percentual a {member.displayName}
          </option>
        ))}
      </select>
      <label htmlFor="rule-payer">Pagador responsável</label>
      <select
        id="rule-payer"
        name="designatedPayerId"
        defaultValue={household.designatedPayerId ?? ''}
      >
        <option value="">Escolher em cada despesa</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.displayName}
          </option>
        ))}
      </select>
      <label htmlFor="rule-day">Dia de repasse</label>
      <input
        id="rule-day"
        name="transferDay"
        type="number"
        min={1}
        max={31}
        defaultValue={household.transferDay}
        required
      />
      <p className="form-note muted">
        A regra é guardada quando vocês registram a primeira renda ou despesa de
        cada mês. Alterações aqui valem para competências que ainda não têm
        lançamentos. Os meses já iniciados mantêm seu combinado.
      </p>
      <Feedback state={state} />
      <button className="button primary" type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar combinado'}
      </button>
    </form>
  );
}
