'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel empty-state">
      <h1>Não foi possível abrir esta tela.</h1>
      <p>
        Tente carregar novamente. Seus dados de demonstração ficam nesta aba.
      </p>
      <button className="button primary" onClick={reset}>
        Tentar novamente
      </button>
    </section>
  );
}
