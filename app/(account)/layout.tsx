import Link from 'next/link';
import { ChartNoAxesCombined } from 'lucide-react';
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
      <a className="skip-link" href="#account-main">
        Pular para o conteúdo
      </a>
      <header className="account-header">
        <Link className="account-brand" href="/casal">
          <span className="brand-mark">
            <ChartNoAxesCombined size={22} />
          </span>
          <span>
            contas <span className="brand-light">a dois</span>
          </span>
        </Link>
        <SignOut />
      </header>
      <main id="account-main" tabIndex={-1} className="account-container">
        {children}
      </main>
      <footer className="page-footer">
        <Link href="/privacidade">Privacidade</Link> · Contas a Dois
      </footer>
    </div>
  );
}
