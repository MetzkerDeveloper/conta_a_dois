'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleHelp,
  House,
  ReceiptText,
  Settings2,
  Wallet,
} from 'lucide-react';

const links = [
  { href: '/', label: 'Visão geral', icon: House },
  { href: '/despesas', label: 'Despesas', icon: ReceiptText },
  { href: '/rendas', label: 'Rendas', icon: Wallet },
  { href: '/repasses', label: 'Repasses', icon: ArrowLeftRight },
  { href: '/ajustes', label: 'Ajustes', icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <ChartNoAxesCombined size={22} />
          </span>
          <span>
            contas<span className="brand-light"> a dois</span>
            <small>O que é nosso, em dia.</small>
          </span>
        </Link>
        <div className="household">
          <span className="avatar-pair">
            <b>A</b>
            <b>B</b>
          </span>
          <div>
            <strong>Ana & Bruno</strong>
            <small>Nosso espaço</small>
          </div>
        </div>
        <nav aria-label="Navegação principal">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${pathname === href ? 'active' : ''}`}
              aria-current={pathname === href ? 'page' : undefined}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <CircleHelp size={19} />
            <strong>
              Uma regra clara.
              <br />
              Menos contas na cabeça.
            </strong>
            <p>Dividir as despesas também pode ser simples.</p>
            <Link href="/ajustes">
              Entenda a divisão <ArrowUpRight size={15} />
            </Link>
          </div>
          <small>Contas a Dois · MVP 0.1</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Nosso espaço <span className="muted">/ Novembro de 2026</span>
          </span>
          <div className="topbar-actions">
            <Link className="text-link" href="/login">
              Entrar no meu espaço
            </Link>
            <span className="demo-badge">
              <span />
              Demonstração
            </span>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="main-content">
          {children}
        </main>
        <footer className="page-footer">
          Feito para vocês dividirem os números e seguirem juntos.
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Navegação no celular">
        {links
          .filter((item) => item.href !== '/rendas')
          .map(({ href, label, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              aria-current={pathname === href ? 'page' : undefined}
              className={pathname === href ? 'active' : ''}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
      </nav>
    </>
  );
}
