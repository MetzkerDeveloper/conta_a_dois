import Link from 'next/link';
import { safeReturnPath } from '@/lib/security/redirect';
import { PasswordForm } from '@/features/auth/components/password-form';

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  return (
    <main className="account-container auth-container">
      <section className="panel account-card">
        <h1>Cadastre sua senha</h1>
        {token && !params.error ? (
          <PasswordForm token={token} />
        ) : (
          <p role="alert">
            Link inválido ou expirado. Solicite um novo e-mail na tela de login.
          </p>
        )}
        <Link
          href={`/login?next=${encodeURIComponent(safeReturnPath(params.next))}`}
        >
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
