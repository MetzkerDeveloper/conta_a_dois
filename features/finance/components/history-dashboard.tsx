'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ChartNoAxesCombined,
  PiggyBank,
  ReceiptText,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { FinancialHistory } from '../history';
import { monthLabel } from '../month';
import { formatMoney } from '@/lib/money';
import {
  reserveScenario,
  safeCents,
  summarizeHistory,
} from '@/lib/settlement/financial-history';
import { RefreshFinance } from './navigation';

export function HistoryDashboard({ data }: { data: FinancialHistory }) {
  const [selectedMonth, setSelectedMonth] = useState(data.month);
  const [percent, setPercent] = useState(50);
  const selected =
    data.rows.find((row) => row.month === selectedMonth) ?? data.rows.at(-1)!;
  const complete = data.rows.filter((row) => row.started && row.outlook);
  const summary = summarizeHistory(
    complete.map((row) => ({
      incomeCents: row.outlook!.incomeCents,
      expenseCents: row.expenseCents,
      remainingCents: row.outlook!.remainingCents,
    })),
  );
  const closed = complete.filter((row) => row.closed);
  const closedSummary = summarizeHistory(
    closed.map((row) => ({
      incomeCents: row.outlook!.incomeCents,
      expenseCents: row.expenseCents,
      remainingCents: row.outlook!.remainingCents,
    })),
  );
  const scenario = reserveScenario(
    selected.outlook?.remainingCents ?? 0,
    percent,
    selected.expenseCents,
  );
  const maxCents = Math.max(
    1,
    ...data.rows.flatMap((row) => [
      row.expenseCents,
      row.outlook?.incomeCents ?? 0,
    ]),
  );
  const width = (cents: number) =>
    `${Number((BigInt(cents) * 10000n) / BigInt(maxCents)) / 100}%`;
  const categoryPercent = (cents: number) =>
    Number((BigInt(cents) * 100n) / (categoryTotal || 1n));
  const previous =
    data.rows[data.rows.findIndex((row) => row.month === selected.month) - 1];
  const comparable =
    selected.started &&
    selected.outlook &&
    previous?.started &&
    previous.outlook;
  const categoryTotal = selected.categories.reduce(
    (sum, item) => sum + BigInt(item.amountCents),
    0n,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Planejar o futuro</p>
          <h1>Evolução financeira</h1>
          <p className="muted">
            Entendam o ritmo das contas e quanto pode sobrar para os próximos
            planos.
          </p>
        </div>
        <RefreshFinance />
      </div>
      <form action="/casal/evolucao" method="get" className="history-filters">
        <div>
          <label htmlFor="history-end">Até a competência</label>
          <input
            id="history-end"
            name="mes"
            type="month"
            defaultValue={data.month}
            min="2000-01"
            max="2199-12"
            required
          />
        </div>
        <div>
          <label htmlFor="history-range">Histórico</label>
          <select id="history-range" name="periodo" defaultValue={data.range}>
            <option value="6">Últimos 6 meses</option>
            <option value="12">Últimos 12 meses</option>
          </select>
        </div>
        <button className="button secondary" type="submit">
          Atualizar período
        </button>
      </form>
      <div className="summary-grid finance-summary">
        <section className="panel stat">
          <span className="stat-label">
            <Wallet size={18} />
            Renda no período
          </span>
          <strong>{formatMoney(summary.incomeCents)}</strong>
          <small>{summary.count} meses iniciados com as duas rendas</small>
        </section>
        <section className="panel stat">
          <span className="stat-label">
            <ReceiptText size={18} />
            Despesas no período
          </span>
          <strong>{formatMoney(summary.expenseCents)}</strong>
          <small>Nos mesmos meses com cálculo disponível</small>
        </section>
        <section className="panel stat">
          <span className="stat-label">
            <TrendingUp size={18} />
            Sobra prevista no período
          </span>
          <strong
            className={summary.remainingCents < 0 ? 'history-negative' : ''}
          >
            {formatMoney(summary.remainingCents)}
          </strong>
          <small>Renda menos despesas, incluindo meses abertos</small>
        </section>
        <section className="panel stat">
          <span className="stat-label">
            <PiggyBank size={18} />
            Média mensal de sobra
          </span>
          <strong>{formatMoney(summary.averageRemainingCents)}</strong>
          <small>
            {closed.length} meses fechados · sobra total{' '}
            {formatMoney(closedSummary.remainingCents)}
          </small>
        </section>
      </div>
      <p className="notice">
        Sobra prevista = renda − cota de despesas, após o acerto entre vocês.
        Inclui contas a pagar e somente gastos registrados; não representa saldo
        bancário ou dinheiro já guardado. Meses sem lançamentos ficam fora dos
        indicadores, mesmo com renda fixa disponível.
      </p>
      {summary.count === 0 && (
        <section className="panel account-card">
          <h2>O histórico começa com o primeiro mês de vocês</h2>
          <p className="muted">
            Cadastrem as duas rendas e as despesas para acompanhar as sobras.
            Renda zero também pode ser cadastrada.
          </p>
          <Link href={`/casal/rendas?mes=${data.month}`} className="text-link">
            Cadastrar rendas
          </Link>
        </section>
      )}
      <section
        className="panel account-card history-chart"
        aria-labelledby="history-title"
      >
        <div className="section-heading">
          <h2 id="history-title">
            <ChartNoAxesCombined size={20} />
            Renda × despesas
          </h2>
          <span className="period-status">Selecione um mês para explorar</span>
        </div>
        <div className="history-legend">
          <span>
            <i className="history-income" />
            Renda
          </span>
          <span>
            <i className="history-expense" />
            Despesas
          </span>
        </div>
        <div className="history-bars">
          {data.rows.map((row) => (
            <button
              key={row.month}
              type="button"
              className="history-month"
              aria-pressed={row.month === selected.month}
              onClick={() => setSelectedMonth(row.month)}
              aria-label={`${monthLabel(row.month)}: ${row.started ? (row.outlook ? `renda ${formatMoney(row.outlook.incomeCents)}, despesas ${formatMoney(row.expenseCents)}, sobra ${formatMoney(row.outlook.remainingCents)}` : 'rendas incompletas') : 'sem lançamentos'}`}
            >
              <span className="history-month-name">
                {monthLabel(row.month)}
              </span>
              <span className="history-tracks">
                <span className="history-track">
                  <i
                    className="history-income"
                    style={{
                      width:
                        row.started && row.outlook
                          ? width(row.outlook.incomeCents)
                          : '0%',
                    }}
                  />
                </span>
                <span className="history-track">
                  <i
                    className="history-expense"
                    style={{
                      width: row.started ? width(row.expenseCents) : '0%',
                    }}
                  />
                </span>
              </span>
              <span className="history-month-value">
                {row.started
                  ? row.outlook
                    ? formatMoney(row.outlook.remainingCents)
                    : 'Rendas incompletas'
                  : 'Sem lançamentos'}
                <small>
                  {row.started
                    ? row.closed
                      ? 'Fechado'
                      : 'Em aberto · previsão'
                    : 'Fora dos indicadores'}
                </small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <div className="history-detail-heading" aria-live="polite">
        <h2>{monthLabel(selected.month)}</h2>
        <Link className="text-link" href={`/casal?mes=${selected.month}`}>
          Abrir competência
        </Link>
      </div>
      {comparable && (
        <p className="muted history-comparison">
          Em relação ao mês anterior: renda{' '}
          {formatMoney(
            safeCents(
              BigInt(selected.outlook!.incomeCents) -
                BigInt(previous.outlook!.incomeCents),
            ),
          )}
          , despesas{' '}
          {formatMoney(
            safeCents(
              BigInt(selected.expenseCents) - BigInt(previous.expenseCents),
            ),
          )}
          , sobra{' '}
          {formatMoney(
            safeCents(
              BigInt(selected.outlook!.remainingCents) -
                BigInt(previous.outlook!.remainingCents),
            ),
          )}
          . Valores positivos indicam aumento.
        </p>
      )}
      {!selected.started && (
        <p className="notice">
          Este mês ainda não tem lançamentos. Os valores de renda abaixo são
          projeções da renda fixa e não entram nos indicadores do período.
        </p>
      )}
      {!selected.outlook && (
        <p className="notice">
          Faltam as rendas dos dois membros para calcular a sobra e simular a
          reserva desta competência.{' '}
          <Link
            className="text-link"
            href={`/casal/rendas?mes=${selected.month}`}
          >
            Ver rendas
          </Link>
        </p>
      )}
      <div className="history-details">
        <section className="panel account-card">
          <h2>Quanto deve sobrar para cada um</h2>
          <p className="muted">
            A cota segue a regra desta competência e a redistribuição aplicada.
          </p>
          <div className="history-members">
            {data.members.map((member) => {
              const values = selected.outlook?.members.find(
                (item) => item.userId === member.userId,
              );
              return (
                <div key={member.userId}>
                  <h3>{member.displayName}</h3>
                  <dl>
                    <div>
                      <dt>Renda</dt>
                      <dd>
                        {values
                          ? formatMoney(values.incomeCents)
                          : 'A cadastrar'}
                      </dd>
                    </div>
                    <div>
                      <dt>Cota de despesas</dt>
                      <dd>{values ? formatMoney(values.shareCents) : '—'}</dd>
                    </div>
                    <div className="balance">
                      <dt>
                        {values && values.remainingCents < 0
                          ? 'Falta na renda'
                          : 'Sobra prevista'}
                      </dt>
                      <dd
                        className={
                          values && values.remainingCents < 0
                            ? 'history-negative'
                            : ''
                        }
                      >
                        {values ? formatMoney(values.remainingCents) : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
          <p className="muted">
            Ainda a pagar neste mês: {formatMoney(selected.unpaidCents)}. Pagar
            uma conta ou confirmar um repasse não muda a sobra final prevista.
          </p>
        </section>
        <section className="panel account-card">
          <h2>Para onde vai o dinheiro</h2>
          {selected.categories.length === 0 ? (
            <p className="muted">Sem despesas registradas nesta competência.</p>
          ) : (
            <ul className="history-categories">
              {[...selected.categories]
                .sort((a, b) => b.amountCents - a.amountCents)
                .map((category) => (
                  <li key={category.id}>
                    <div>
                      <span>{category.name}</span>
                      <strong>{formatMoney(category.amountCents)}</strong>
                    </div>
                    <progress
                      value={categoryPercent(category.amountCents)}
                      max={100}
                      aria-label={`${category.name}: participação nas despesas`}
                    />
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
      <section
        className="panel account-card history-reserve"
        aria-labelledby="reserve-title"
      >
        <div>
          <p className="eyebrow">Próximo passo</p>
          <h2 id="reserve-title">
            <PiggyBank size={21} />
            Simulador de reserva
          </h2>
          <p className="muted">
            Explore uma contribuição mensal com base na sobra de{' '}
            {monthLabel(selected.month)}. A simulação começa em zero, sem
            rendimentos e sem considerar uma reserva já existente.
          </p>
          <label htmlFor="reserve-percent">
            Separar {percent}% da sobra positiva do casal
          </label>
          <input
            id="reserve-percent"
            type="range"
            min="0"
            max="100"
            step="5"
            value={percent}
            onChange={(event) => setPercent(Number(event.target.value))}
            disabled={!selected.started || !selected.outlook}
          />
          <p className="muted">
            Cenário ilustrativo de seis meses das despesas registradas nesta
            competência. Ajustem a contribuição às necessidades de vocês.
          </p>
        </div>
        <div className="history-reserve-values" aria-live="polite">
          {selected.started && selected.outlook ? (
            <>
              <div>
                <span>Contribuição mensal simulada</span>
                <strong>{formatMoney(scenario.contributionCents)}</strong>
              </div>
              <div>
                <span>Em 12 meses, mantendo a contribuição</span>
                <strong>{formatMoney(scenario.annualCents)}</strong>
              </div>
              <div>
                <span>Referência: 6 meses de despesas</span>
                <strong>{formatMoney(scenario.targetCents)}</strong>
              </div>
              <p>
                {scenario.monthsToTarget
                  ? `${scenario.monthsToTarget} meses para chegar à referência, mantendo os valores deste cenário.`
                  : 'Cadastrem despesas e tenham sobra positiva para estimar um prazo.'}
              </p>
              {selected.outlook.remainingCents <= 0 && (
                <p className="history-negative">
                  A renda registrada não deixa margem para uma contribuição
                  neste cenário.
                </p>
              )}
            </>
          ) : (
            <p className="muted">
              O simulador fica disponível quando o mês tiver lançamentos e as
              duas rendas.
            </p>
          )}
        </div>
      </section>
      <section className="panel account-card">
        <h2>Histórico em números</h2>
        <div className="history-table-scroll">
          <table className="history-table">
            <caption className="sr-only">
              Renda, despesas e sobra prevista por competência
            </caption>
            <thead>
              <tr>
                <th scope="col">Competência</th>
                <th scope="col">Renda</th>
                <th scope="col">Despesas</th>
                <th scope="col">Sobra prevista</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.month}>
                  <th scope="row">
                    <Link href={`/casal?mes=${row.month}`}>
                      {monthLabel(row.month)}
                    </Link>
                  </th>
                  <td>
                    {row.started && row.outlook
                      ? formatMoney(row.outlook.incomeCents)
                      : '—'}
                  </td>
                  <td>{row.started ? formatMoney(row.expenseCents) : '—'}</td>
                  <td
                    className={
                      row.outlook && row.outlook.remainingCents < 0
                        ? 'history-negative'
                        : ''
                    }
                  >
                    {row.started && row.outlook
                      ? formatMoney(row.outlook.remainingCents)
                      : '—'}
                  </td>
                  <td>
                    {!row.started
                      ? 'Sem lançamentos'
                      : row.closed
                        ? 'Fechado'
                        : row.outlook
                          ? 'Em aberto'
                          : 'Rendas incompletas'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
