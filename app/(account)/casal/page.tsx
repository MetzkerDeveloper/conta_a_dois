import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarDays,
  Plus,
  ReceiptText,
  CircleCheck,
  Clock3,
  Wallet,
  ArrowLeftRight,
} from 'lucide-react';
import { InviteCard } from '@/features/household/components/invite-card';
import { FinanceHeader } from '@/features/finance/components/header';
import { loadFinance, type SearchParams } from '@/features/finance/queries';
import { transferDate } from '@/features/finance/month';
import { formatMoney } from '@/lib/money';
import { monthFingerprint } from '@/features/finance/service';
import { RedistributionForm } from '@/features/finance/components/redistribution-form';
import { MonthForm } from '@/features/finance/components/cycle-forms';

export default async function HouseholdPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await loadFinance(await searchParams);
  const { household, members, month, result, capacitySuggestion } = data;
  const redistributionEnabled = data.period?.redistributeByIncome ?? false;
  const incomesComplete =
    members.length === 2 &&
    members.every((member) =>
      data.incomes.some((income) => income.userId === member.userId),
    );
  const name = (id: string) =>
    members.find((member) => member.userId === id)?.displayName ?? 'Membro';
  const date = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(
    new Date(`${transferDate(month, data.rule.transferDay)}T12:00:00Z`),
  );
  return (
    <>
      <FinanceHeader
        title={household.name}
        description="As contas de vocês, salvas e organizadas por mês."
        month={month}
      />
      <div className="finance-toolbar">
        <span className="period-status">
          {data.period?.closedAt ? 'Mês fechado' : 'Mês aberto'} ·{' '}
          {data.expenses.length} despesas
        </span>
        {!data.period?.closedAt && (
          <Link
            className="button primary finance-add"
            href={`/casal/despesas/nova?mes=${month}`}
          >
            <Plus size={17} />
            Lançar despesa
          </Link>
        )}
      </div>
      <div className="summary-grid finance-summary">
        <section className="panel stat">
          <span className="stat-label">
            <Wallet size={18} />
            Renda do casal
          </span>
          <strong data-testid="household-income-total">
            {formatMoney(data.incomeTotalCents)}
          </strong>
          <small>
            {incomesComplete
              ? 'As duas rendas confirmadas no mês'
              : `Total parcial · ${data.incomes.length} de 2 rendas confirmadas`}
          </small>
          {!incomesComplete && (
            <Link className="text-link" href={`/casal/rendas?mes=${month}`}>
              Confirmar rendas
            </Link>
          )}
        </section>
        <section className="panel stat">
          <span className="stat-label">
            <ReceiptText size={18} />
            Despesas do mês
          </span>
          <strong data-testid="month-total">
            {formatMoney(data.totalCents)}
          </strong>
          <small>Todos os lançamentos da competência</small>
        </section>
        <section className="panel stat">
          <span className="stat-label">
            <CircleCheck size={18} />
            Já foi pago
          </span>
          <strong>{formatMoney(data.totalCents - data.unpaidCents)}</strong>
          <small>Pagamentos feitos por vocês</small>
        </section>
        <section className="panel stat">
          <span className="stat-label">
            <Clock3 size={18} />
            Ainda falta pagar
          </span>
          <strong>{formatMoney(data.unpaidCents)}</strong>
          <small>Contas sem pagador confirmado</small>
        </section>
      </div>
      {(capacitySuggestion || redistributionEnabled) &&
        !data.period?.closedAt && (
          <section
            className="panel account-card capacity-card"
            aria-label="Sugestão de redistribuição"
          >
            <div className="section-heading">
              <h2>
                <ArrowLeftRight size={19} />
                {redistributionEnabled
                  ? 'Redistribuição aplicada neste mês'
                  : 'Uma divisão que cabe melhor na renda'}
              </h2>
              <span className="period-status">
                {redistributionEnabled ? 'Ativa' : 'Sugestão'}
              </span>
            </div>
            <p className="muted">
              {redistributionEnabled
                ? 'O acerto considera a redistribuição. Novas despesas ou mudanças nas rendas recalculam este ajuste somente nesta competência.'
                : 'A parte de alguém nas despesas ultrapassa a própria renda. Vocês podem redistribuir a diferença até o limite da renda disponível do par.'}
            </p>
            {capacitySuggestion && (
              <>
                <div className="capacity-members">
                  {members.map((member) => (
                    <div key={member.userId}>
                      <strong>{member.displayName}</strong>
                      <span>
                        Renda:{' '}
                        {formatMoney(
                          data.incomes.find(
                            (income) => income.userId === member.userId,
                          )!.amountCents,
                        )}
                      </span>
                      <span>
                        Parte original:{' '}
                        {formatMoney(
                          capacitySuggestion.originalShares[member.userId]!,
                        )}
                      </span>
                      <span>
                        {redistributionEnabled
                          ? 'Parte ajustada'
                          : 'Parte sugerida'}
                        :{' '}
                        <b>
                          {formatMoney(
                            capacitySuggestion.shares[member.userId]!,
                          )}
                        </b>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="muted">
                  {capacitySuggestion.redistributedCents > 0
                    ? `${formatMoney(capacitySuggestion.redistributedCents)} ${redistributionEnabled ? 'redistribuídos' : 'podem ser redistribuídos'} para quem tem margem na renda.`
                    : 'Nenhum dos dois tem margem de renda para assumir a diferença.'}
                </p>
                {capacitySuggestion.uncoveredCents > 0 && (
                  <p className="capacity-warning" role="status">
                    Faltam {formatMoney(capacitySuggestion.uncoveredCents)} na
                    renda do casal para cobrir as despesas. Redistribuir não
                    elimina essa falta; o excedente continua na parte de quem
                    ultrapassou a renda.
                  </p>
                )}
              </>
            )}
            {!redistributionEnabled && (
              <p className="muted form-note">
                A sugestão usa toda a renda confirmada como limite. Ao aplicar,
                as cotas e o repasse mudam; os pagamentos já registrados são
                preservados. O ajuste vale apenas para este mês e acompanha
                mudanças nas rendas e despesas até vocês restaurarem a divisão
                original.
              </p>
            )}
            {(redistributionEnabled ||
              (capacitySuggestion?.redistributedCents ?? 0) > 0) && (
              <RedistributionForm
                key={`${month}:${redistributionEnabled}:${monthFingerprint(data)}`}
                month={month}
                fingerprint={monthFingerprint(data)}
                enabled={redistributionEnabled}
                blocked={data.settlements.some(
                  (item) => item.status === 'pending',
                )}
              />
            )}
          </section>
        )}
      <div className="finance-overview">
        {!result ? (
          <section className="panel account-card calculation-pending">
            <h2>
              {members.length < 2
                ? 'Falta seu par para calcular a divisão.'
                : 'Confirmem as rendas para calcular o acerto.'}
            </h2>
            <p className="muted">
              {members.length < 2
                ? 'Você já pode registrar sua renda e as despesas. O cálculo fica disponível depois que a outra pessoa entrar e vocês confirmarem as rendas.'
                : 'A renda do mês anterior é apenas uma sugestão. Cada pessoa precisa confirmar a própria renda, inclusive quando ela for zero.'}
            </p>
            <Link
              className="button secondary auth-submit"
              href={`/casal/rendas?mes=${month}`}
            >
              Ver rendas do mês
            </Link>
          </section>
        ) : (
          <section className="transfer-card" aria-label="Repasse sugerido">
            <div className="transfer-top">
              <p className="eyebrow">Acerto do mês</p>
              <span className="subtle-badge">
                {result.transfer
                  ? 'Repasse sugerido'
                  : 'Sem repasse neste momento'}
              </span>
            </div>
            <div className="transfer-main">
              <div>
                <p>
                  {result.transfer
                    ? `${name(result.transfer.from)} repassa para ${name(result.transfer.to)}`
                    : 'Nenhum valor a repassar entre vocês.'}
                </p>
                <strong
                  className="transfer-value"
                  data-testid="suggested-transfer"
                >
                  {formatMoney(result.transfer?.amountCents ?? 0)}
                </strong>
                <p className="transfer-caption">
                  {data.unpaidCents > 0
                    ? 'Há contas pendentes. O acerto será recalculado quando elas forem pagas.'
                    : 'Cotas calculadas a partir das rendas e dos pagamentos deste mês.'}
                </p>
              </div>
              <span className="transfer-symbol">
                <ArrowUpRight size={32} />
              </span>
            </div>
            <div className="transfer-bottom">
              <span>
                <CalendarDays size={16} />
                Dia combinado: {date}
              </span>
            </div>
            <p className="transfer-caption settlement-limit">
              Os repasses confirmados já foram descontados. Envios pendentes
              ainda fazem parte do saldo.
            </p>
            {data.settlements.some((item) => item.status === 'pending') && (
              <p className="transfer-caption settlement-limit">
                Há um envio aguardando confirmação. Confira em Repasses antes de
                enviar novamente.
              </p>
            )}
            <Link
              href={`/casal/repasses?mes=${month}`}
              className="button secondary auth-submit"
            >
              Ver e registrar repasses
            </Link>
          </section>
        )}
        <div className="account-grid">
          {members.map((member) => {
            const income = data.incomes.find(
              (item) => item.userId === member.userId,
            );
            return (
              <section
                className="panel account-card member-finances"
                key={member.userId}
              >
                <h2>
                  {member.displayName}
                  {member.userId === data.userId ? ' · Você' : ''}
                </h2>
                <dl>
                  <div>
                    <dt>Renda do mês</dt>
                    <dd>
                      {income ? formatMoney(income.amountCents) : 'A confirmar'}
                    </dd>
                  </div>
                  {result && (
                    <>
                      <div>
                        <dt>Cota nas despesas</dt>
                        <dd>{formatMoney(result.shares[member.userId]!)}</dd>
                      </div>
                      <div>
                        <dt>Já pagou</dt>
                        <dd>{formatMoney(result.paid[member.userId]!)}</dd>
                      </div>
                      <div className="balance">
                        <dt>
                          {result.balances[member.userId]! < 0
                            ? 'Crédito a receber'
                            : 'Saldo a cobrir'}
                        </dt>
                        <dd>
                          {formatMoney(
                            Math.abs(result.balances[member.userId]!),
                          )}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </section>
            );
          })}
        </div>
      </div>
      <div className="finance-details">
        <section className="panel account-card">
          <div className="section-heading">
            <h2>O combinado deste mês</h2>
            <Link className="text-link" href={`/casal/ajustes?mes=${month}`}>
              Ver ajustes
            </Link>
          </div>
          <p>
            {data.rule.splitMode === 'equal'
              ? 'Divisão igual: 50/50.'
              : data.rule.splitMode === 'proportional'
                ? 'Divisão proporcional à renda de cada pessoa.'
                : `${data.rule.higherShareBps / 100}% para quem ganha mais e ${(10000 - data.rule.higherShareBps) / 100}% para a outra pessoa.`}
          </p>
          {redistributionEnabled && (
            <p className="notice">
              Redistribuição por renda aplicada nesta competência. As cotas
              foram ajustadas a partir desse combinado.
            </p>
          )}
          <p className="form-note muted">
            {data.period
              ? 'Esta competência mantém a regra guardada no primeiro lançamento.'
              : 'A regra será guardada quando vocês registrarem a primeira renda ou despesa deste mês.'}
          </p>
        </section>
        <section className="panel account-card">
          <div className="section-heading">
            <h2>Próximas contas a pagar</h2>
            <Link href={`/casal/despesas?mes=${month}`} className="text-link">
              Ver despesas
            </Link>
          </div>
          {data.expenses.some((expense) => !expense.paidByUserId) ? (
            <ul className="real-upcoming">
              {data.expenses
                .filter((expense) => !expense.paidByUserId)
                .slice(0, 5)
                .map((expense) => (
                  <li key={expense.id}>
                    <Link
                      href={`/casal/despesas/${expense.id}/editar?mes=${month}`}
                    >
                      <span>
                        {expense.description}
                        <small>
                          Vence em{' '}
                          {expense.dueDate.split('-').reverse().join('/')}
                        </small>
                      </span>
                      <strong>{formatMoney(expense.amountCents)}</strong>
                    </Link>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="muted">
              {data.expenses.length
                ? 'Todas as despesas deste mês têm um pagador confirmado.'
                : 'Nenhuma despesa neste mês. Comece lançando a primeira conta.'}
            </p>
          )}
        </section>
        <section className="panel account-card">
          <h2>Quem faz parte</h2>
          <ul className="household-people">
            {members.map((member) => (
              <li key={member.userId}>
                <span className="avatar">
                  {member.displayName.charAt(0).toUpperCase()}
                </span>
                <strong>{member.displayName}</strong>
                <span className="muted">Membro {member.slot}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {members.length === 1 && <InviteCard />}
      <section className="panel account-card">
        <h2>
          {data.period?.closedAt ? 'Competência fechada' : 'Fechar competência'}
        </h2>
        <MonthForm
          key={`${month}:${data.period?.closedAt?.toISOString() ?? 'open'}`}
          month={month}
          fingerprint={monthFingerprint(data)}
          closedAt={data.period?.closedAt?.toISOString() ?? null}
        />
      </section>
    </>
  );
}
