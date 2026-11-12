import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { FinanceHeader } from '@/features/finance/components/header';
import {
  SettlementForm,
  SettlementTransition,
} from '@/features/finance/components/settlement-forms';
import { loadSettlements, type SearchParams } from '@/features/finance/queries';
import { formatMoney } from '@/lib/money';

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await loadSettlements(await searchParams);
  const transfer = data.result?.transfer;
  const pending = data.settlements.find((item) => item.status === 'pending');
  const name = (id: string) =>
    data.members.find((member) => member.userId === id)?.displayName ??
    'Membro';
  const date = (value: Date) =>
    new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(value);
  return (
    <>
      <FinanceHeader
        title="Repasses do mês"
        description="Registre o envio e confirme o recebimento para acertar o saldo."
        month={data.month}
        path="/casal/repasses"
      />
      <section className="panel account-card">
        <h2>Saldo a repassar</h2>
        <p className="income-value">
          {data.result ? formatMoney(transfer?.amountCents ?? 0) : 'A calcular'}
        </p>
        <p className="muted">
          {!data.result
            ? 'É preciso completar o casal e cadastrar as duas rendas.'
            : transfer
              ? `${name(transfer.from)} repassa para ${name(transfer.to)}. Os repasses confirmados já foram descontados.`
              : 'Nenhum valor a repassar neste momento.'}
        </p>
        {pending && (
          <p className="notice">
            Há um envio de {formatMoney(pending.amountCents)} aguardando
            confirmação. Ele ainda faz parte do saldo acima. Resolva esse
            registro antes de enviar outro valor.
          </p>
        )}
        {!pending &&
          !data.period?.closedAt &&
          transfer?.from === data.userId && (
            <SettlementForm
              key={`${data.month}:${transfer.from}:${transfer.amountCents}`}
              month={data.month}
              amountCents={transfer.amountCents}
              creationKey={randomUUID()}
            />
          )}
        <Link
          href={`/casal?mes=${data.month}`}
          className="text-link auth-submit"
        >
          Ver cálculo no painel
        </Link>
      </section>
      <section className="panel account-card">
        <h2>Histórico de repasses</h2>
        {data.settlements.length === 0 ? (
          <p className="muted">Nenhum repasse registrado nesta competência.</p>
        ) : (
          data.settlements.map((item) => (
            <article className="settlement-record" key={item.id}>
              <div className="section-heading">
                <strong>
                  {name(item.fromUserId)} → {name(item.toUserId)}
                </strong>
                <strong className="money">
                  {formatMoney(item.amountCents)}
                </strong>
              </div>
              <p className="muted">
                {item.status === 'pending'
                  ? 'Aguardando confirmação'
                  : item.status === 'confirmed'
                    ? 'Recebimento confirmado'
                    : 'Registro cancelado'}{' '}
                · {date(item.createdAt)}
              </p>
              {item.confirmedAt && (
                <p className="form-note muted">
                  Confirmado em {date(item.confirmedAt)}
                </p>
              )}
              {item.status === 'pending' && !data.period?.closedAt && (
                <SettlementTransition
                  month={data.month}
                  id={item.id}
                  canConfirm={item.toUserId === data.userId}
                />
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}
