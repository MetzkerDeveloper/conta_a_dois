import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="not-found panel">
      <p className="eyebrow">404</p>
      <h1>Esta página não existe.</h1>
      <Link className="button primary" href="/">
        Voltar ao painel
      </Link>
    </main>
  );
}
