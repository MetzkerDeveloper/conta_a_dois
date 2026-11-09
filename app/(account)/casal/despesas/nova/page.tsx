import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { ExpenseForm } from '@/features/finance/components/forms';
import { loadFinance, type SearchParams } from '@/features/finance/queries';
import { monthLabel } from '@/features/finance/month';

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await loadFinance(await searchParams);
  return (
    <section className="panel account-card finance-form-card">
      <p className="eyebrow">{monthLabel(data.month)}</p>
      <h1>Nova despesa</h1>
      {data.period?.closedAt ? (
        <>
          <p>Este mês está fechado e não aceita novos lançamentos.</p>
          <Link
            className="button secondary auth-submit"
            href={`/casal/despesas?mes=${data.month}`}
          >
            Voltar às despesas
          </Link>
        </>
      ) : (
        <ExpenseForm
          key={data.month}
          month={data.month}
          members={data.members}
          categories={data.categories.filter((category) => category.active)}
          creationKey={randomUUID()}
          designatedPayerId={data.rule.designatedPayerId}
        />
      )}
    </section>
  );
}
