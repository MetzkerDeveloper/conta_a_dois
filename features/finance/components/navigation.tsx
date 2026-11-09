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
