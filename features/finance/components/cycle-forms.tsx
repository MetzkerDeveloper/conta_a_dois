'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  generateRecurringAction,
  monthAction,
  saveRecurringAction,
} from '../cycle-actions';
import { inputMoney } from '../month';
import type { getRecurring, MonthlyFinance } from '../service';

export function RecurringGenerator({ month }: { month: string }) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void generateRecurringAction(month)
      .then((state) => {
        if (active) setMessage(state.error ?? state.message ?? '');
      })
      .catch(() => {
        if (active)
          setMessage('Atualize a página para gerar as contas recorrentes.');
      });
    return () => {
      active = false;
    };
  }, [month]);
  return message ? (
    <p role="status" className="notice">
      {message}
    </p>
  ) : null;
}

type Recurring = Awaited<ReturnType<typeof getRecurring>>[number];
export function RecurringForm({
  month,
  categories,
  creationKey,
  recurring,
}: {
  month: string;
  categories: MonthlyFinance['categories'];
  creationKey: string;
  recurring?: Recurring;
}) {
  const [state, action, pending] = useActionState(saveRecurringAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={recurring?.id ?? ''} />
      <input type="hidden" name="version" value={recurring?.version ?? 0} />
      <input
        type="hidden"
        name="creationKey"
        value={recurring?.creationKey ?? creationKey}
      />
      <label htmlFor={`rec-description-${creationKey}`}>Descrição</label>
      <input
        id={`rec-description-${creationKey}`}
        name="description"
        defaultValue={recurring?.description}
        minLength={2}
        maxLength={120}
        required
      />
      <div className="form-grid">
        <div>
          <label htmlFor={`rec-amount-${creationKey}`}>Valor mensal (R$)</label>
          <input
            id={`rec-amount-${creationKey}`}
            name="amount"
            inputMode="decimal"
            defaultValue={recurring ? inputMoney(recurring.amountCents) : ''}
            maxLength={30}
            required
          />
        </div>
        <div>
          <label htmlFor={`rec-day-${creationKey}`}>Dia de vencimento</label>
          <input
            id={`rec-day-${creationKey}`}
            name="dayOfMonth"
            type="number"
            min={1}
            max={31}
            defaultValue={recurring?.dayOfMonth ?? 5}
            required
          />
        </div>
      </div>
      <label htmlFor={`rec-category-${creationKey}`}>Categoria</label>
      <select
        id={`rec-category-${creationKey}`}
        name="categoryId"
        defaultValue={
          recurring?.categoryId ??
          categories.find((item) => item.name === 'Outros')?.id
        }
      >
        {categories.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <label htmlFor={`rec-start-${creationKey}`}>Primeira competência</label>
      <input
        id={`rec-start-${creationKey}`}
        name="startMonth"
        type="month"
        min="2000-01"
        max="2199-12"
        defaultValue={recurring?.startMonth.slice(0, 7) ?? month}
        readOnly={!!recurring}
        required
      />
      <label className="consent-label">
        <input
          name="active"
          type="checkbox"
          defaultChecked={recurring?.active ?? true}
        />
        <span>Recorrência ativa</span>
      </label>
      <p className="form-note muted">
        As contas são geradas ao abrir cada competência e ficam a pagar. Em
        meses curtos, vence no último dia válido. Desativar ou editar não altera
        as contas já geradas.
      </p>
      {state.error && (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="notice">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="button primary">
        {pending
          ? 'Salvando…'
          : recurring
            ? 'Salvar recorrência'
            : 'Criar recorrência'}
      </button>
    </form>
  );
}

export function MonthForm({
  month,
  fingerprint,
  closedAt,
}: {
  month: string;
  fingerprint: string;
  closedAt: string | null;
}) {
  const [state, action, pending] = useActionState(monthAction, {});
  return (
    <form action={action}>
      <input
        type="hidden"
        name="action"
        value={closedAt ? 'reopen' : 'close'}
      />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="fingerprint" value={fingerprint} />
      <input type="hidden" name="closedAt" value={closedAt ?? ''} />
      <p className="muted">
        {closedAt
          ? 'Reabrir libera correções nas rendas, despesas e repasses. A regra da competência é mantida.'
          : 'Para fechar, confirmem as duas rendas, paguem as contas e concluam os repasses. O fechamento congela os números do período.'}
      </p>
      <label className="consent-label">
        <input type="checkbox" name="acknowledged" required />
        <span>
          {closedAt
            ? 'Quero reabrir este mês para correções.'
            : 'Conferi os lançamentos e quero fechar este mês.'}
        </span>
      </label>
      {state.error && (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="notice">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="button secondary">
        {pending ? 'Salvando…' : closedAt ? 'Reabrir mês' : 'Fechar mês'}
      </button>
    </form>
  );
}
