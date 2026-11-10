'use client';

import { useActionState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { redistributeIncomeAction } from '../actions';

export function RedistributionForm({
  month,
  fingerprint,
  enabled,
  blocked,
}: {
  month: string;
  fingerprint: string;
  enabled: boolean;
  blocked: boolean;
}) {
  const [state, action, pending] = useActionState(redistributeIncomeAction, {});
  return (
    <form action={action} className="redistribution-form">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="fingerprint" value={fingerprint} />
      <input type="hidden" name="enabled" value={String(!enabled)} />
      <button
        type="submit"
        className={`button ${enabled ? 'secondary' : 'primary'}`}
        disabled={pending || blocked}
      >
        <ArrowLeftRight size={17} />
        {pending
          ? 'Ajustando…'
          : enabled
            ? 'Restaurar divisão original'
            : 'Aplicar redistribuição'}
      </button>
      {blocked && (
        <p className="muted form-note">
          Confirme ou cancele os repasses pendentes antes de ajustar a divisão.
        </p>
      )}
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
    </form>
  );
}
