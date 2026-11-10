import { AutoRefreshFinance } from '@/features/finance/components/auto-refresh';
import { FinanceNavigation } from '@/features/finance/components/navigation';

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="finance-area">
      <FinanceNavigation />
      <div className="finance-content">
        <AutoRefreshFinance />
        {children}
      </div>
    </div>
  );
}
