import type { Expense, Member, Result, Rule } from './types';

function integer(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} deve ser um inteiro não negativo seguro.`);
  }
}

function safeNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new Error('Total excede o limite seguro.');
  return number;
}

// Inteiros positivos: arredonda metade para cima, sem ponto flutuante.
function roundedRatio(
  total: bigint,
  numerator: bigint,
  denominator: bigint,
): bigint {
  return (2n * total * numerator + denominator) / (2n * denominator);
}

export function calculate(
  members: [Member, Member],
  rule: Rule,
  expenses: Expense[],
): Result {
  if (
    members.length !== 2 ||
    members.some((m) => !m.userId) ||
    members[0].userId === members[1].userId
  ) {
    throw new Error('O casal deve ter exatamente dois membros distintos.');
  }
  for (const member of members) integer(member.incomeCents, 'Renda');
  integer(rule.higherShareBps, 'Percentual');
  if (rule.higherShareBps > 10000)
    throw new Error('Percentual deve estar entre 0 e 10000.');
  if (!['fixed', 'equal', 'proportional'].includes(rule.mode))
    throw new Error('Modo inválido.');
  if (
    rule.tiebreakUserId !== undefined &&
    !members.some((m) => m.userId === rule.tiebreakUserId)
  ) {
    throw new Error('Desempate deve apontar para um membro do casal.');
  }

  // Sem maior ganhador, o ID ordenado define apenas quem recebe o arredondamento.
  const ordered = [...members].sort((a, b) => (a.userId < b.userId ? -1 : 1));
  const first = ordered[0]!;
  const second = ordered[1]!;
  const higher =
    first.incomeCents === second.incomeCents
      ? (members.find((m) => m.userId === rule.tiebreakUserId) ?? first)
      : first.incomeCents > second.incomeCents
        ? first
        : second;
  const other = members.find((m) => m.userId !== higher.userId)!;
  const paid: Record<string, number> = Object.fromEntries(
    members.map((m) => [m.userId, 0]),
  );
  let total = 0n;
  let unpaid = 0n;
  for (const expense of expenses) {
    integer(expense.amountCents, 'Despesa');
    if (expense.amountCents === 0)
      throw new Error('Despesa deve ser positiva.');
    const amount = BigInt(expense.amountCents);
    total += amount;
    if (expense.paidByUserId === null) unpaid += amount;
    else {
      if (!members.some((m) => m.userId === expense.paidByUserId))
        throw new Error('Pagador inválido.');
      paid[expense.paidByUserId] = safeNumber(
        BigInt(paid[expense.paidByUserId]!) + amount,
      );
    }
  }

  let numerator = 1n;
  let denominator = 2n;
  if (
    rule.mode === 'fixed' &&
    (higher.incomeCents !== other.incomeCents || rule.tiebreakUserId)
  ) {
    numerator = BigInt(rule.higherShareBps);
    denominator = 10000n;
  } else if (rule.mode === 'proportional') {
    const income = BigInt(higher.incomeCents) + BigInt(other.incomeCents);
    if (income > 0n) {
      numerator = BigInt(higher.incomeCents);
      denominator = income;
    }
  }
  const higherShare = roundedRatio(total, numerator, denominator);
  const shares = Object.fromEntries([
    [higher.userId, safeNumber(higherShare)],
    [other.userId, safeNumber(total - higherShare)],
  ]);
  const balances = Object.fromEntries(
    members.map((m) => [m.userId, shares[m.userId]! - paid[m.userId]!]),
  );
  const debtor = members.find((m) => balances[m.userId]! > 0);
  const creditor = members.find((m) => balances[m.userId]! < 0);
  return {
    totalCents: safeNumber(total),
    shares,
    paid,
    balances,
    transfer:
      debtor && creditor
        ? {
            from: debtor.userId,
            to: creditor.userId,
            amountCents: Math.min(
              balances[debtor.userId]!,
              -balances[creditor.userId]!,
            ),
          }
        : null,
    unpaidCents: safeNumber(unpaid),
  };
}
