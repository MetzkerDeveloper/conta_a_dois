import { FinanceHeader } from '@/features/finance/components/header';
import { IncomeForm } from '@/features/finance/components/forms';
import { loadFinance, type SearchParams } from '@/features/finance/queries';
import { formatMoney } from '@/lib/money';

export default async function IncomesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await loadFinance(await searchParams);
  const own = data.incomes.find((income) => income.userId === data.userId);
  const previous = data.previousIncomes.find(
    (income) => income.userId === data.userId,
  );
  return (
    <>
      <FinanceHeader
        title="Rendas do mês"
        description="Cada pessoa confirma sua renda líquida. Os valores ficam visíveis para o casal."
        month={data.month}
        path="/casal/rendas"
      />
      <div className="account-grid">
        {data.members.map((member) => {
          const income = data.incomes.find(
            (item) => item.userId === member.userId,
          );
          return (
            <section className="panel account-card" key={member.userId}>
              <h2>
                {member.displayName}
                {member.userId === data.userId ? ' · Você' : ''}
              </h2>
              <p className="income-value">
                {income ? formatMoney(income.amountCents) : 'A confirmar'}
              </p>
              <p role="status" className="muted">
                {income
                  ? 'Renda confirmada nesta competência.'
                  : 'Aguardando confirmação para este mês.'}
              </p>
            </section>
          );
        })}
      </div>
      <section className="panel account-card finance-form-card">
        <h2>Confirme sua renda</h2>
        <IncomeForm
          key={`${data.month}:${own?.version ?? 0}`}
          month={data.month}
          income={own}
          suggestion={previous?.amountCents}
          closed={!!data.period?.closedAt}
        />
      </section>
    </>
  );
}
