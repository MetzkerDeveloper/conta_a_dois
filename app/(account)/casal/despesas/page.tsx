import Link from 'next/link';
import { Pencil, Plus, ReceiptText } from 'lucide-react';
import { FinanceHeader } from '@/features/finance/components/header';
import { DeleteExpense } from '@/features/finance/components/forms';
import { loadFinance, type SearchParams } from '@/features/finance/queries';
import { formatMoney } from '@/lib/money';

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await loadFinance(params);
  const category = typeof params.categoria === 'string' ? params.categoria : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const filtered = data.expenses.filter(
    (expense) =>
      (!category || expense.categoryId === category) &&
      (status === 'pending'
        ? !expense.paidByUserId
        : status === 'paid'
          ? !!expense.paidByUserId
          : true),
  );
  return (
    <>
      <FinanceHeader
        title="Despesas do mês"
        description="Registre as contas, o vencimento e quem já pagou."
        month={data.month}
        path="/casal/despesas"
      />
      <div className="finance-toolbar">
        <Link
          href={`/casal/despesas/recorrentes?mes=${data.month}`}
          className="button secondary"
        >
          Gerenciar recorrências
        </Link>
        <span className="period-status">
          {filtered.length} de {data.expenses.length} despesas · total do mês{' '}
          {formatMoney(data.totalCents)}
        </span>
        {!data.period?.closedAt && (
          <Link
            className="button primary finance-add"
            href={`/casal/despesas/nova?mes=${data.month}`}
          >
            <Plus size={17} />
            Lançar despesa
          </Link>
        )}
      </div>
      {(params.salva === '1' || params.excluida === '1') && (
        <p className="notice" role="status">
          {params.excluida === '1'
            ? 'Despesa excluída. O painel foi recalculado.'
            : 'Despesa salva. O painel foi recalculado.'}
        </p>
      )}
      <form method="get" className="expense-filters" action="/casal/despesas">
        <input type="hidden" name="mes" value={data.month} />
        <div>
          <label htmlFor="category-filter">Categoria</label>
          <select
            key={category}
            id="category-filter"
            name="categoria"
            defaultValue={category}
          >
            <option value="">Todas as categorias</option>
            {data.displayCategories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status-filter">Pagamento</label>
          <select
            key={status}
            id="status-filter"
            name="status"
            defaultValue={status}
          >
            <option value="">Todos</option>
            <option value="pending">A pagar</option>
            <option value="paid">Pagas</option>
          </select>
        </div>
        <button type="submit" className="button secondary">
          Filtrar
        </button>
      </form>
      <section className="panel real-expense-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <ReceiptText size={28} />
            <h2>Nenhuma despesa por aqui.</h2>
            <p>
              {data.expenses.length
                ? 'Tente outra categoria ou outro estado de pagamento.'
                : 'Lance a primeira conta para começar a acompanhar este mês.'}
            </p>
          </div>
        ) : (
          <ul className="expense-rows">
            {filtered.map((expense) => (
              <li key={expense.id} data-testid="real-expense-row">
                <div className="expense-description">
                  <strong>{expense.description}</strong>
                  <small>
                    {
                      data.displayCategories.find(
                        (item) => item.id === expense.categoryId,
                      )?.name
                    }{' '}
                    · Vence em {expense.dueDate.split('-').reverse().join('/')}
                  </small>
                  {expense.notes && (
                    <p className="expense-note">{expense.notes}</p>
                  )}
                </div>
                <div className="expense-amount">
                  <strong>{formatMoney(expense.amountCents)}</strong>
                  <small
                    className={
                      expense.paidByUserId ? 'paid-label' : 'pending-label'
                    }
                  >
                    {expense.paidByUserId
                      ? `Pago por ${data.members.find((member) => member.userId === expense.paidByUserId)?.displayName}`
                      : 'A pagar'}
                  </small>
                </div>
                {!data.period?.closedAt && (
                  <div className="expense-row-actions">
                    <Link
                      className="icon-button"
                      aria-label={`Editar ${expense.description}`}
                      href={`/casal/despesas/${expense.id}/editar?mes=${data.month}`}
                    >
                      <Pencil size={16} />
                    </Link>
                    <DeleteExpense expense={expense} month={data.month} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
