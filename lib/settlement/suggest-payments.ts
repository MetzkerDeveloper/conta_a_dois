import type { Result } from './types';

type PendingExpense = {
  id: string;
  amountCents: number;
  paidByUserId: string | null;
};

/** Heurística determinística: contas maiores primeiro, minimizando o saldo restante. */
export function suggestPayments(
  result: Result,
  expenses: PendingExpense[],
  designatedPayerId: string | null = null,
): Record<string, string> {
  const ids = Object.keys(result.balances).sort();
  if (ids.length !== 2) throw new Error('O casal deve ter dois membros.');
  if (designatedPayerId && !ids.includes(designatedPayerId))
    throw new Error('Pagador inválido.');
  const remaining = Object.fromEntries(
    ids.map((id) => [id, BigInt(result.balances[id]!)]),
  );
  const abs = (value: bigint) => (value < 0n ? -value : value);
  const suggestions: Record<string, string> = {};
  const pending = expenses
    .filter((expense) => expense.paidByUserId === null)
    .sort((a, b) => b.amountCents - a.amountCents || a.id.localeCompare(b.id));
  for (const expense of pending) {
    if (!Number.isSafeInteger(expense.amountCents) || expense.amountCents <= 0)
      throw new Error('Despesa deve ser um inteiro positivo seguro.');
    const amount = BigInt(expense.amountCents);
    const [first, second] = ids as [string, string];
    const costFirst = abs(remaining[first]! - amount) + abs(remaining[second]!);
    const costSecond =
      abs(remaining[first]!) + abs(remaining[second]! - amount);
    const payer =
      designatedPayerId ??
      (costFirst < costSecond
        ? first
        : costSecond < costFirst
          ? second
          : remaining[first]! >= remaining[second]!
            ? first
            : second);
    suggestions[expense.id] = payer;
    remaining[payer]! -= amount;
  }
  return suggestions;
}
