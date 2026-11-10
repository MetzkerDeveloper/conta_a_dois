import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAuthConfigured } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { safeReturnPath } from '@/lib/security/redirect';
import { LoginForm } from '@/features/auth/components/login-form';

export const dynamic = 'force-dynamic';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnPath = safeReturnPath(params.next);
  const configured = isAuthConfigured();
  if (configured) {
    const session = await getSession();
    if (session?.user.emailVerified) redirect(returnPath);
  }
  return (
    <main className="account-container auth-container">
      <Link className="account-brand" href="/">
        contas a dois
      </Link>
      <section className="panel account-card">
        <p className="eyebrow">Seu espaço compartilhado</p>
        <h1>
          Contas em dia.
          <br />A dois.
        </h1>
        <p className="muted">
          Entre para criar o espaço de vocês ou aceitar um convite.
        </p>
        {configured ? (
          <LoginForm returnPath={returnPath} linkError={!!params.erro} />
        ) : (
          <div className="empty-state">
            <h2>O acesso às contas ainda não está disponível.</h2>
            <p>Enquanto isso, conheça o painel com dados de exemplo.</p>
            <Link href="/" className="button primary">
              Explorar demonstração
            </Link>
          </div>
        )}
        <div className="account-links">
          <Link href="/">Ver demonstração</Link>
          <Link href="/privacidade">Privacidade</Link>
        </div>
      </section>
    </main>
  );
}
