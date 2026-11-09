import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { FinanceHeader } from '@/features/finance/components/header';
import { RecurringForm } from '@/features/finance/components/cycle-forms';
import { getRecurring } from '@/features/finance/service';
import { loadFinance, type SearchParams } from '@/features/finance/queries';
import { formatMoney } from '@/lib/money';

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await loadFinance(await searchParams);
  const templates = await getRecurring(getDb(), data.userId);
  return (
    <>
      <FinanceHeader
        title="Despesas recorrentes"
        description="Cadastre uma vez e gere as contas dos próximos meses."
        month={data.month}
        path="/casal/despesas/recorrentes"
      />
      <section className="panel account-card finance-form-card">
        <h2>Nova recorrência</h2>
        <RecurringForm
          month={data.month}
          categories={data.categories}
          creationKey={randomUUID()}
        />
      </section>
      <section className="panel account-card">
        <h2>Recorrências do casal</h2>
        {templates.length === 0 ? (
          <p className="muted">Nenhuma recorrência cadastrada.</p>
        ) : (
          templates.map((template) => (
            <details className="settlement-record" key={template.id}>
              <summary>
                {template.description} · {formatMoney(template.amountCents)} ·{' '}
                {template.active ? 'Ativa' : 'Pausada'}
              </summary>
              <RecurringForm
                month={data.month}
                categories={data.categories}
                creationKey={template.id}
                recurring={template}
              />
            </details>
          ))
        )}
      </section>
    </>
  );
}
