'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleAlert,
  ReceiptText,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from 'lucide-react';
import { formatMoney, parseMoney } from '@/lib/money';
import { categories } from '../data';
import { useDemo } from './demo-provider';
import { ExpenseDialog } from './expense-dialog';

type Section = 'painel' | 'despesas' | 'rendas' | 'repasses' | 'ajustes';
const titles: Record<Section, [string, string]> = {
  painel: ['Tudo às claras.', 'Uma visão do mês para vocês seguirem em dia.'],
  despesas: [
    'Cada conta no seu lugar.',
    'Acompanhem o que já foi pago e o que ainda falta.',
  ],
  rendas: [
    'O ponto de partida.',
    'As rendas do mês ajudam a definir a divisão.',
  ],
  repasses: [
    'Acertem as contas.',
    'Vejam quanto precisa ir de uma conta para a outra.',
  ],
  ajustes: [
    'Do jeito de vocês.',
    'Uma regra combinada deixa tudo mais simples.',
  ],
};

export function DemoScreen({ section }: { section: Section }) {
  const { notice } = useDemo();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {section === 'painel' ? 'Visão geral' : section}
          </p>
          <h1>{titles[section][0]}</h1>
          <p className="muted">{titles[section][1]}</p>
        </div>
        <div className="heading-actions">
          <span className="month-chip">
            <CalendarDays size={16} />
            Novembro 2026
          </span>
          {(section === 'painel' || section === 'despesas') && (
            <ExpenseDialog />
          )}
        </div>
      </div>
      <div className="demo-note">
        <CircleAlert size={16} />
        <span>
          Este é um espaço de demonstração com dados fictícios. As alterações
          duram até recarregar a página.
        </span>
      </div>
      <div role="status" className={notice ? 'notice' : 'sr-only'}>
        {notice}
      </div>
      {section === 'painel' && <Dashboard />}
      {section === 'despesas' && <ExpenseList />}
      {section === 'rendas' && <Incomes />}
      {section === 'repasses' && (
        <>
          <TransferCard />
          <section className="panel empty-state">
            <ReceiptText size={28} />
            <h2>O histórico começa com o primeiro repasse.</h2>
            <p>
              O registro de envio e a confirmação de recebimento estarão
              disponíveis após conectar as contas do casal.
            </p>
          </section>
        </>
      )}
      {section === 'ajustes' && <Settings />}
    </>
  );
}

function TransferCard() {
  const { result, members } = useDemo();
  const name = (id: string) =>
    members.find((member) => member.userId === id)!.name;
  const transfer = result.transfer;
  return (
    <section className="transfer-card">
      <div className="transfer-top">
        <span className="eyebrow">Acerto do mês</span>
        <span className="subtle-badge">
          {transfer ? 'Repasse sugerido' : 'Sem repasse'}
        </span>
      </div>
      <div className="transfer-main">
        <div>
          <p>
            {transfer
              ? `${name(transfer.from)} repassa para ${name(transfer.to)}`
              : 'Nenhum valor a repassar'}
          </p>
          <strong className="transfer-value">
            {formatMoney(transfer?.amountCents ?? 0)}
          </strong>
          <p className="transfer-caption">
            {result.unpaidCents > 0
              ? 'Há contas pendentes. O acerto pode mudar quando forem pagas.'
              : 'Considerando todas as despesas pagas deste mês.'}
          </p>
        </div>
        <span className="transfer-symbol">
          <ArrowUpRight size={32} strokeWidth={1.5} />
        </span>
      </div>
      <div className="transfer-bottom">
        <span>
          <CalendarDays size={16} />
          Dia de repasse: 25 de novembro
        </span>
        <Link href="/repasses">
          Ver detalhes <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

function Dashboard() {
  const { result, expenses, members } = useDemo();
  return (
    <>
      <div className="summary-grid">
        <div className="panel stat">
          <span className="stat-label">
            <ReceiptText size={17} />
            Despesas do mês
          </span>
          <strong>{formatMoney(result.totalCents)}</strong>
          <small>{expenses.length} lançamentos neste mês</small>
        </div>
        <div className="panel stat">
          <span className="stat-label">
            <Check size={17} />
            Já foi pago
          </span>
          <strong>{formatMoney(result.totalCents - result.unpaidCents)}</strong>
          <small>Somando os pagamentos de vocês</small>
        </div>
        <div className="panel stat">
          <span className="stat-label">
            <CalendarDays size={17} />
            Ainda falta pagar
          </span>
          <strong>{formatMoney(result.unpaidCents)}</strong>
          <small>
            {result.unpaidCents === 0
              ? 'Todas as contas estão pagas'
              : 'Contas aguardando pagamento'}
          </small>
        </div>
      </div>
      <div className="dashboard-grid">
        <TransferCard />
        <section className="panel split-card">
          <div className="section-heading">
            <h2>A divisão de vocês</h2>
            <Link
              className="icon-button"
              href="/ajustes"
              aria-label="Ajustar divisão"
            >
              <SlidersHorizontal size={18} />
            </Link>
          </div>
          <p className="muted">Cada um com a sua parte. Tudo combinado.</p>
          <div className="split-track" aria-hidden="true">
            <span
              style={{
                width: `${result.totalCents ? (result.shares[members[0].userId]! / result.totalCents) * 100 : 50}%`,
              }}
            />
          </div>
          {members.map((member, index) => (
            <div className="split-row" key={member.userId}>
              <span className={`dot dot-${index}`} />
              <span>{member.name}</span>
              <strong>
                {result.totalCents
                  ? Math.round(
                      (result.shares[member.userId]! / result.totalCents) * 100,
                    )
                  : 50}
                %
              </strong>
              <span className="money">
                {formatMoney(result.shares[member.userId]!)}
              </span>
            </div>
          ))}
        </section>
      </div>
      <div className="dashboard-grid lower-grid">
        <ExpenseList compact />
        <section className="panel member-summary">
          <div className="section-heading">
            <h2>Como fica para cada um</h2>
            <Link href="/rendas" className="text-link">
              Rendas <ArrowRight size={14} />
            </Link>
          </div>
          {members.map((member, index) => (
            <div className="member-block" key={member.userId}>
              <div className="member-name">
                <span className={`avatar avatar-${index}`}>
                  {member.name[0]}
                </span>
                <strong>{member.name}</strong>
              </div>
              <dl>
                <div>
                  <dt>Sua cota</dt>
                  <dd>{formatMoney(result.shares[member.userId]!)}</dd>
                </div>
                <div>
                  <dt>Já pagou</dt>
                  <dd>{formatMoney(result.paid[member.userId]!)}</dd>
                </div>
                <div className="balance">
                  <dt>
                    {result.balances[member.userId]! < 0 ? (
                      <>
                        <ArrowDownLeft size={14} />A receber
                      </>
                    ) : (
                      <>
                        <ArrowUpRight size={14} />
                        Saldo a cobrir
                      </>
                    )}
                  </dt>
                  <dd>
                    {formatMoney(Math.abs(result.balances[member.userId]!))}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function ExpenseList({ compact = false }: { compact?: boolean }) {
  const { expenses, setExpenses, setNotice, members } = useDemo();
  const [category, setCategory] = useState('Todas');
  const filtered = expenses
    .filter((expense) => category === 'Todas' || expense.category === category)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const visible = compact ? filtered.slice(0, 5) : filtered;
  return (
    <section className="panel expense-list">
      <div className="section-heading">
        <h2>{compact ? 'Contas do mês' : 'Despesas de novembro'}</h2>
        {compact ? (
          <Link href="/despesas" className="text-link">
            Ver todas <ArrowRight size={14} />
          </Link>
        ) : (
          <div>
            <label className="sr-only" htmlFor="filter">
              Filtrar por categoria
            </label>
            <select
              id="filter"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option>Todas</option>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {visible.length === 0 ? (
        <div className="empty-state">
          <ReceiptText size={28} />
          <h3>Nenhuma despesa por aqui.</h3>
          <p>
            {category === 'Todas'
              ? 'Use “Nova despesa” para começar.'
              : 'Experimente selecionar outra categoria.'}
          </p>
        </div>
      ) : (
        <ul className="expense-rows">
          {visible.map((expense) => (
            <li key={expense.id}>
              <span className="expense-icon">
                <ReceiptText size={19} />
              </span>
              <div className="expense-description">
                <strong>{expense.description}</strong>
                <small>
                  {expense.category} <span aria-hidden="true">·</span>{' '}
                  {expense.dueDate.slice(8)}/11
                </small>
              </div>
              <div className="expense-amount">
                <strong>{formatMoney(expense.amountCents)}</strong>
                <small
                  className={
                    expense.paidByUserId ? 'paid-label' : 'pending-label'
                  }
                >
                  {expense.paidByUserId ? (
                    <>
                      <Check size={12} />
                      Pago por{' '}
                      {
                        members.find((m) => m.userId === expense.paidByUserId)
                          ?.name
                      }
                    </>
                  ) : (
                    'A pagar'
                  )}
                </small>
              </div>
              {!compact && (
                <button
                  className="icon-button delete-button"
                  aria-label={`Excluir ${expense.description}`}
                  onClick={() => {
                    setExpenses((items) =>
                      items.filter((item) => item.id !== expense.id),
                    );
                    setNotice(
                      `${expense.description} removida da demonstração.`,
                    );
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {compact && (
        <div className="list-footer">
          <span className="dot" />
          {
            expenses.filter((expense) => expense.paidByUserId === null).length
          }{' '}
          contas pendentes neste mês
        </div>
      )}
    </section>
  );
}

function Incomes() {
  const { members, setMembers, setNotice } = useDemo();
  const [values, setValues] = useState(() =>
    members.map((member) =>
      formatMoney(member.incomeCents).replace('R$', '').trim(),
    ),
  );
  const [error, setError] = useState('');
  return (
    <section className="panel settings-panel">
      <div className="section-heading">
        <h2>Rendas líquidas de novembro</h2>
        <Wallet size={20} />
      </div>
      <p className="muted">
        Informe o valor que entra na conta depois dos descontos.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const amounts = values.map(parseMoney);
            if (amounts.some((amount) => amount < 0))
              throw new Error('A renda não pode ser negativa.');
            setMembers([
              { ...members[0], incomeCents: amounts[0]! },
              { ...members[1], incomeCents: amounts[1]! },
            ]);
            setError('');
            setNotice(
              'Rendas atualizadas na demonstração. A divisão foi recalculada.',
            );
          } catch {
            setError(
              'Informe rendas válidas, iguais ou maiores que zero. Ex.: 7.000,00.',
            );
          }
        }}
      >
        {members.map((member, index) => (
          <div key={member.userId}>
            <label htmlFor={`income-${member.userId}`}>
              {member.name} · renda líquida (R$)
            </label>
            <input
              id={`income-${member.userId}`}
              inputMode="decimal"
              value={values[index]}
              onChange={(event) =>
                setValues((items) =>
                  items.map((item, i) =>
                    i === index ? event.target.value : item,
                  ),
                )
              }
              aria-invalid={!!error}
              aria-describedby={error ? 'income-error' : undefined}
              required
            />
          </div>
        ))}
        {error && (
          <p className="field-error" id="income-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" type="submit">
          Atualizar rendas
        </button>
      </form>
    </section>
  );
}

function Settings() {
  const { rule, setRule, resetDemo } = useDemo();
  return (
    <section className="panel settings-panel">
      <h2>A regra da divisão</h2>
      <p className="muted">
        Teste como cada modo muda as cotas e o repasse no painel.
      </p>
      <label htmlFor="mode">Como dividir as despesas?</label>
      <select
        id="mode"
        value={rule.mode}
        onChange={(event) =>
          setRule({ ...rule, mode: event.target.value as typeof rule.mode })
        }
      >
        <option value="fixed">Percentual fixo</option>
        <option value="equal">Igualmente · 50/50</option>
        <option value="proportional">Proporcional às rendas</option>
      </select>
      {rule.mode === 'fixed' && (
        <>
          <label htmlFor="share">
            Parte de quem tem a maior renda: {rule.higherShareBps / 100}%
          </label>
          <input
            id="share"
            type="range"
            min="0"
            max="10000"
            step="100"
            value={rule.higherShareBps}
            onChange={(event) =>
              setRule({ ...rule, higherShareBps: Number(event.target.value) })
            }
          />
          <div className="range-labels">
            <span>0%</span>
            <span>100%</span>
          </div>
        </>
      )}
      <label htmlFor="tiebreak">Em caso de rendas iguais</label>
      <select
        id="tiebreak"
        value={rule.tiebreakUserId ?? ''}
        onChange={(event) =>
          setRule({ ...rule, tiebreakUserId: event.target.value || undefined })
        }
      >
        <option value="">Dividir 50/50</option>
        <option value="ana">Ana recebe o percentual configurado</option>
        <option value="bruno">Bruno recebe o percentual configurado</option>
      </select>
      <p className="form-note muted">
        Nesta simulação, a regra muda imediatamente. Com dados reais, alterações
        serão aplicadas por competência, preservando os meses fechados.
      </p>
      <Link href="/rendas" className="button secondary">
        <Wallet size={16} />
        Editar rendas
      </Link>
      <div className="settings-divider">
        <h3>Recomeçar a demonstração</h3>
        <p className="muted">
          Restaura as despesas, as rendas e a regra 70/30 do exemplo.
        </p>
        <button className="button secondary" onClick={resetDemo}>
          <RotateCcw size={16} />
          Restaurar exemplo
        </button>
      </div>
    </section>
  );
}
