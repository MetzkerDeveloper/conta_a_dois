'use client';

export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <section className="panel account-card">
      <h1>Não conseguimos abrir seu espaço.</h1>
      <p className="muted">
        Não foi possível verificar o acesso ou carregar os dados agora. Tente
        novamente em instantes. Suas contas continuam salvas.
      </p>
      <button className="button primary auth-submit" onClick={reset}>
        Tentar novamente
      </button>
    </section>
  );
}
