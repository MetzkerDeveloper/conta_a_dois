import type { Result } from './types';

type Transfer = { fromUserId: string; toUserId: string; amountCents: number };

/** Recebe somente repasses confirmados; pendentes não alteram o saldo. */
export function applyTransfers(result: Result, confirmed: Transfer[]): Result {
  const balances = Object.fromEntries(
    Object.entries(result.balances).map(([id, cents]) => [id, BigInt(cents)]),
  );
  for (const transfer of confirmed) {
    if (
      !(transfer.fromUserId in balances) ||
      !(transfer.toUserId in balances) ||
      transfer.fromUserId === transfer.toUserId ||
      !Number.isSafeInteger(transfer.amountCents) ||
      transfer.amountCents <= 0
    )
      throw new Error('Repasse inválido.');
    balances[transfer.fromUserId]! -= BigInt(transfer.amountCents);
    balances[transfer.toUserId]! += BigInt(transfer.amountCents);
  }
  const adjusted = Object.fromEntries(
    Object.entries(balances).map(([id, cents]) => {
      const value = Number(cents);
      if (!Number.isSafeInteger(value))
        throw new Error('Saldo excede o limite seguro.');
      return [id, value];
    }),
  );
  const debtor = Object.keys(adjusted).find((id) => adjusted[id]! > 0);
  const creditor = Object.keys(adjusted).find((id) => adjusted[id]! < 0);
  return {
    ...result,
    balances: adjusted,
    transfer:
      debtor && creditor
        ? {
            from: debtor,
            to: creditor,
            amountCents: Math.min(adjusted[debtor]!, -adjusted[creditor]!),
          }
        : null,
  };
}
