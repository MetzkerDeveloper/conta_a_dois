import Link from 'next/link';
import { SignOut } from '@/features/auth/components/sign-out';

export const dynamic = 'force-dynamic';
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A autorização também é feita em cada página/action; layout não é a fronteira de segurança.
  // A página do convite preserva o retorno após login, então não redirecionar aqui.
  return (
    <div className="account-layout">
      <header className="account-header">
        <Link className="account-brand" href="/casal">
          contas a dois
        </Link>
        <SignOut />
      </header>
      <main className="account-container">{children}</main>
      <footer className="page-footer">
        <Link href="/privacidade">Privacidade</Link> · Contas a Dois
      </footer>
    </div>
  );
}
