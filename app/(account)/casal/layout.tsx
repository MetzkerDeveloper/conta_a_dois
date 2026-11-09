import { FinanceNavigation } from '@/features/finance/components/navigation';

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="finance-area">
      <FinanceNavigation />
      {children}
    </div>
  );
}
