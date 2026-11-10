'use client';

import { useActionState, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { payExpenseAction } from '../actions';
import { useHydrated } from '@/lib/use-hydrated';

type Member = { userId: string; displayName: string };
export function QuickPayment({
  expense,
  month,
  members,
  userId,
}: {
  expense: {
    id: string;
    description: string;
    version: number;
    paidByUserId: string | null;
  };
  month: string;
  members: Member[];
  userId: string;
}) {
  const hydrated = useHydrated();
  const [expanded, setExpanded] = useState(false);
  const [state, action, pending] = useActionState(payExpenseAction, {});
  if (expense.paidByUserId)
    return state.message ? (
      <p className="quick-payment-feedback" role="status">
        {state.message}
      </p>
    ) : null;
  return (
    <div className="quick-payment">
      {!expanded ? (
        <button
          className="button secondary"
          type="button"
          disabled={!hydrated}
          onClick={() => setExpanded(true)}
        >
          <CircleCheck size={16} /> Marcar como paga
        </button>
      ) : (
        <form
          action={action}
          className="quick-payment-form"
          aria-label={`Pagamento de ${expense.description}`}
          aria-busy={pending}
        >
          <input type="hidden" name="id" value={expense.id} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="version" value={expense.version} />
          <label htmlFor={`payer-${expense.id}`}>Quem pagou?</label>
          <select
            id={`payer-${expense.id}`}
            name="paidByUserId"
            defaultValue={userId}
            disabled={pending}
            required
          >
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
                {member.userId === userId ? ' (você)' : ''}
              </option>
            ))}
          </select>
          <button className="button primary" type="submit" disabled={pending}>
            {pending ? 'Confirmando…' : 'Confirmar pagamento'}
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={pending}
            onClick={() => setExpanded(false)}
          >
            Cancelar
          </button>
          {state.error && (
            <p className="field-error" role="alert">
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
