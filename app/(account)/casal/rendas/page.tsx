import { FinanceHeader } from '@/features/finance/components/header';
import { IncomeForm } from '@/features/finance/components/forms';
import { loadIncomes, type SearchParams } from '@/features/finance/queries';
import { formatMoney } from '@/lib/money';

export default async function IncomesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await loadIncomes(await searchParams);
  const own = data.incomes.find((income) => income.userId === data.userId);
  return (
    <>
      <FinanceHeader
        title="Rendas do mês"
        description="A renda fixa se repete automaticamente. Ajustes e extras podem valer só neste mês."
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
                {income ? formatMoney(income.amountCents) : 'A cadastrar'}
              </p>
              <p role="status" className="muted">
                {income
                  ? 'Renda disponível nesta competência.'
                  : 'Cadastre a renda uma vez para os próximos meses.'}
              </p>
            </section>
          );
        })}
      </div>
      <section className="panel account-card finance-form-card">
        <h2>Sua renda fixa e extras do mês</h2>
        <IncomeForm
          key={`${data.month}:${own?.version ?? 0}`}
          month={data.month}
          income={own}
          closed={!!data.period?.closedAt}
        />
      </section>
    </>
  );
}
