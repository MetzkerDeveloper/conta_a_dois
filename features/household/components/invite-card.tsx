'use client';

import { useActionState, useState } from 'react';
import { Copy, Link as LinkIcon } from 'lucide-react';
import { createInviteAction } from '../actions';

export function InviteCard() {
  const [state, action, pending] = useActionState(createInviteAction, {});
  const [copyMessage, setCopyMessage] = useState('');
  return (
    <section className="panel account-card">
      <p className="eyebrow">Falta uma pessoa</p>
      <h2>Convide seu par.</h2>
      <p className="muted">
        Gere um link e compartilhe com quem vai dividir este espaço. Ele vale
        por sete dias e só pode ser usado uma vez.
      </p>
      <form action={action} onSubmit={() => setCopyMessage('')}>
        <button
          type="submit"
          className="button primary auth-submit"
          disabled={pending}
        >
          <LinkIcon size={16} />
          {pending
            ? 'Gerando convite…'
            : state.inviteURL
              ? 'Gerar outro link'
              : 'Gerar convite'}
        </button>
      </form>
      {state.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      {state.inviteURL && (
        <div className="invite-result">
          <label htmlFor="invite-url">Link do convite</label>
          <input
            id="invite-url"
            readOnly
            value={state.inviteURL}
            onFocus={(event) => event.target.select()}
          />
          <p className="form-note muted">
            Válido até{' '}
            {new Intl.DateTimeFormat('pt-BR', {
              dateStyle: 'long',
              timeZone: 'America/Sao_Paulo',
            }).format(new Date(state.expiresAt!))}
            . Guarde o link: ele só é exibido nesta tela. Gerar outro invalida o
            anterior.
          </p>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.inviteURL!);
                setCopyMessage('Link copiado. Compartilhe apenas com seu par.');
              } catch {
                setCopyMessage('Selecione o link acima e copie manualmente.');
              }
            }}
          >
            <Copy size={16} />
            Copiar link
          </button>
          <p role="status" className="form-note">
            {copyMessage}
          </p>
        </div>
      )}
    </section>
  );
}
