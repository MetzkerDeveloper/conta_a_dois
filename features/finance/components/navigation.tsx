'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  House,
  ReceiptText,
  Wallet,
  Settings2,
  RefreshCw,
  ArrowLeftRight,
  HeartHandshake,
} from 'lucide-react';
import { useHydrated } from '@/lib/use-hydrated';

const links = [
  { href: '/casal', label: 'Painel', icon: House },
  { href: '/casal/despesas', label: 'Despesas', icon: ReceiptText },
  { href: '/casal/rendas', label: 'Rendas', icon: Wallet },
  { href: '/casal/repasses', label: 'Repasses', icon: ArrowLeftRight },
  { href: '/casal/ajustes', label: 'Ajustes', icon: Settings2 },
];
export function FinanceNavigation() {
  const pathname = usePathname();
  const month = useSearchParams().get('mes');
  return (
    <aside className="finance-sidebar">
      <div className="finance-space">
        <HeartHandshake size={24} />
        <div>
          <strong>Nosso espaço</strong>
          <small>Uma vida a dois. Tudo em dia.</small>
        </div>
      </div>
      <p className="eyebrow finance-nav-label">Organizar o mês</p>
      <nav className="finance-nav" aria-label="Finanças do casal">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/casal' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href + (month ? `?mes=${encodeURIComponent(month)}` : '')}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="finance-sidebar-note">
        <HeartHandshake size={22} />
        <strong>
          Mais parceria.
          <br />
          Menos contas na cabeça.
        </strong>
        <p>Um lugar para cuidar do que é de vocês.</p>
      </div>
    </aside>
  );
}
export function RefreshFinance() {
  const hydrated = useHydrated();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="button secondary"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending || !hydrated}
    >
      <RefreshCw size={15} className={pending ? 'spin' : undefined} />
      {pending ? 'Atualizando…' : 'Atualizar'}
    </button>
  );
}
