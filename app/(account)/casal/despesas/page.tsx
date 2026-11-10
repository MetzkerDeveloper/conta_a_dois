import Link from 'next/link';
import {
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { FinanceHeader } from '@/features/finance/components/header';
import { DeleteExpense } from '@/features/finance/components/forms';
import { loadExpenses, type SearchParams } from '@/features/finance/queries';
import { formatMoney } from '@/lib/money';

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await loadExpenses(params);
  const { category, status, search, page } = data.filters;
  const hasFilters = !!(category || status || search);
  const pageLink = (number: number) => {
    const query = new URLSearchParams({
      mes: data.month,
      pagina: String(number),
    });
    if (category) query.set('categoria', category);
    if (status) query.set('status', status);
    if (search) query.set('busca', search);
    return `/casal/despesas?${query}`;
  };
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
          {data.filteredCount} de {data.totalCount} despesas · total do mês{' '}
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
        <div className="expense-search">
          <label htmlFor="expense-search">Buscar despesa</label>
          <div className="search-field">
            <Search size={17} aria-hidden="true" />
            <input
              key={search}
              id="expense-search"
              name="busca"
              type="search"
              defaultValue={search}
              placeholder="Descrição ou observações"
              maxLength={120}
            />
          </div>
        </div>
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
        {hasFilters && (
          <Link
            className="text-link"
            href={`/casal/despesas?mes=${data.month}`}
          >
            Limpar filtros
          </Link>
        )}
      </form>
      {hasFilters && (
        <p className="expense-results" role="status">
          {data.filteredCount}{' '}
          {data.filteredCount === 1
            ? 'despesa encontrada'
            : 'despesas encontradas'}{' '}
          · total filtrado {formatMoney(data.filteredCents)}
        </p>
      )}
      <section className="panel real-expense-list">
        {data.expenses.length === 0 ? (
          <div className="empty-state">
            <ReceiptText size={28} />
            <h2>Nenhuma despesa por aqui.</h2>
            <p>
              {data.totalCount
                ? 'Tente outra busca, categoria ou estado de pagamento.'
                : 'Lance a primeira conta para começar a acompanhar este mês.'}
            </p>
            {!data.totalCount && !data.period?.closedAt && (
              <Link
                className="button primary auth-submit"
                href={`/casal/despesas/nova?mes=${data.month}`}
              >
                <Plus size={17} /> Lançar primeira despesa
              </Link>
            )}
            {data.totalCount > 0 && hasFilters && (
              <Link
                className="button secondary auth-submit"
                href={`/casal/despesas?mes=${data.month}`}
              >
                Ver todas as despesas
              </Link>
            )}
          </div>
        ) : (
          <ul className="expense-rows">
            {data.expenses.map((expense) => (
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
      {data.filteredCount > 0 && (
        <nav className="expense-pagination" aria-label="Paginação de despesas">
          <p className="muted">
            Mostrando {(page - 1) * data.pageSize + 1}–
            {Math.min(page * data.pageSize, data.filteredCount)} de{' '}
            {data.filteredCount} · Página {page} de {data.pageCount}
          </p>
          <div>
            {page > 1 ? (
              <Link className="button secondary" href={pageLink(page - 1)}>
                <ChevronLeft size={17} />
                Anterior
              </Link>
            ) : (
              <span className="button secondary" aria-disabled="true">
                <ChevronLeft size={17} />
                Anterior
              </span>
            )}
            {page < data.pageCount ? (
              <Link className="button secondary" href={pageLink(page + 1)}>
                Próxima
                <ChevronRight size={17} />
              </Link>
            ) : (
              <span className="button secondary" aria-disabled="true">
                Próxima
                <ChevronRight size={17} />
              </span>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
