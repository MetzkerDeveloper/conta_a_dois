'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { createHouseholdAction, acceptInviteAction } from '../actions';

export function HouseholdForm({
  name,
  token,
}: {
  name: string;
  token?: string;
}) {
  const [mode, setMode] = useState('fixed');
  const [state, action, pending] = useActionState(
    token ? acceptInviteAction : createHouseholdAction,
    {},
  );
  return (
    <form action={action}>
      {token && <input type="hidden" name="token" value={token} />}
      {!token && (
        <>
          <label htmlFor="household-name">Nome do espaço</label>
          <input
            id="household-name"
            name="name"
            placeholder="Ex.: Nossa casa"
            minLength={2}
            maxLength={80}
            required
          />
        </>
      )}
      <label htmlFor="display-name">Como quer ser chamado(a)?</label>
      <input
        id="display-name"
        name="displayName"
        defaultValue={name}
        maxLength={60}
        autoComplete="given-name"
        required
      />
      {!token && (
        <>
          <label htmlFor="split-mode">Como querem dividir as despesas?</label>
          <select
            id="split-mode"
            name="splitMode"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="fixed">Percentual fixo</option>
            <option value="equal">Igualmente · 50/50</option>
            <option value="proportional">Proporcional às rendas</option>
          </select>
          <label htmlFor="higher-share">Parte de quem tem a maior renda</label>
          <select id="higher-share" name="higherShareBps" defaultValue="7000">
            {Array.from({ length: 101 }, (_, percentage) => (
              <option key={percentage} value={percentage * 100}>
                {percentage}%
              </option>
            ))}
          </select>
          <p className="form-note muted">
            {mode === 'fixed'
              ? 'A outra pessoa fica com o restante. Se as rendas forem iguais, a divisão será 50/50.'
              : 'Este percentual só se aplica ao modo fixo.'}
          </p>
          <label htmlFor="transfer-day">Dia combinado para o repasse</label>
          <input
            id="transfer-day"
            name="transferDay"
            type="number"
            min="1"
            max="31"
            defaultValue="25"
            required
          />
          <p className="form-note muted">
            Em meses mais curtos, vale o último dia do mês.
          </p>
        </>
      )}
      <label className="consent-label">
        <input type="checkbox" name="consent" required />
        <span>
          Li e concordo com a{' '}
          <Link href="/privacidade" target="_blank" rel="noreferrer">
            política de privacidade
          </Link>{' '}
          e com o compartilhamento dos dados financeiros com a outra pessoa do
          casal.
        </span>
      </label>
      {state.error && (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        className="button primary full-width auth-submit"
        disabled={pending}
      >
        {pending
          ? 'Salvando…'
          : token
            ? 'Aceitar convite e entrar'
            : 'Criar nosso espaço'}
      </button>
    </form>
  );
}
