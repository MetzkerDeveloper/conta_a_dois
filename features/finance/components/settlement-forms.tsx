'use client';

import { useActionState } from 'react';
import { settlementAction } from '../settlement-actions';
import { inputMoney } from '../month';

export function SettlementForm({
  month,
  amountCents,
  creationKey,
}: {
  month: string;
  amountCents: number;
  creationKey: string;
}) {
  const [state, action, pending] = useActionState(settlementAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="action" value="create" />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="creationKey" value={creationKey} />
      <label htmlFor="transfer-amount">Valor que você já enviou (R$)</label>
      <input
        id="transfer-amount"
        name="amount"
        inputMode="decimal"
        maxLength={30}
        defaultValue={inputMoney(amountCents)}
        required
      />
      <p className="form-note muted">
        Registre apenas um envio já feito pelo seu banco. É possível informar um
        valor parcial. O saldo só muda quando a outra pessoa confirmar o
        recebimento.
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
        {pending ? 'Registrando…' : 'Registrar envio realizado'}
      </button>
    </form>
  );
}

export function SettlementTransition({
  month,
  id,
  canConfirm,
}: {
  month: string;
  id: string;
  canConfirm: boolean;
}) {
  const [state, action, pending] = useActionState(settlementAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="id" value={id} />
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
      <div className="form-actions">
        {canConfirm && (
          <button
            type="submit"
            name="action"
            value="confirm"
            disabled={pending}
            className="button primary"
          >
            Confirmar recebimento
          </button>
        )}
        <button
          type="submit"
          name="action"
          value="cancel"
          disabled={pending}
          className="button secondary"
        >
          {canConfirm ? 'Recusar registro' : 'Cancelar registro'}
        </button>
      </div>
    </form>
  );
}
