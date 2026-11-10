import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExpenseForm } from '@/features/finance/components/forms';
import {
  loadExpenseEditor,
  type SearchParams,
} from '@/features/finance/queries';
import { monthLabel } from '@/features/finance/month';

export default async function EditExpensePage({
  searchParams,
  params,
}: {
  searchParams: Promise<SearchParams>;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadExpenseEditor(await searchParams, id);
  const expense = data.expense;
  if (!expense) notFound();
  return (
    <section className="panel account-card finance-form-card">
      <p className="eyebrow">{monthLabel(data.month)}</p>
      <h1>Editar despesa</h1>
      {data.period?.closedAt ? (
        <>
          <p>Este mês está fechado e não aceita alterações.</p>
          <Link
            className="button secondary auth-submit"
            href={`/casal/despesas?mes=${data.month}`}
          >
            Voltar às despesas
          </Link>
        </>
      ) : (
        <ExpenseForm
          key={`${expense.id}:${expense.version}`}
          month={data.month}
          expense={expense}
          members={data.members}
          categories={data.categories.filter(
            (category) => category.active || category.id === expense.categoryId,
          )}
          designatedPayerId={data.rule.designatedPayerId}
        />
      )}
    </section>
  );
}
