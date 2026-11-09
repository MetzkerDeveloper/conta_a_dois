'use client';

export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <section className="panel account-card">
      <h1>Não conseguimos abrir seu espaço.</h1>
      <p className="muted">
        Atualize a página para conferir os últimos lançamentos antes de tentar
        novamente.
      </p>
      <button className="button primary auth-submit" onClick={reset}>
        Tentar novamente
      </button>
    </section>
  );
}
