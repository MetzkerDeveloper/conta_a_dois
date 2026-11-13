import { calculate } from './calculate';
import { suggestCapacity } from './suggest-capacity';
import type { Member, Rule } from './types';

export function safeCents(value: bigint): number {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents))
    throw new Error('Valor excede o limite seguro.');
  return cents;
}

export function monthlyOutlook(input: {
  members: Member[];
  rule: Rule;
  totalCents: number;
  redistribute: boolean;
  frozenShares?: Record<string, number>;
}) {
  if (input.members.length !== 2) return null;
  const members = input.members as [Member, Member];
  const result = calculate(
    members,
    input.rule,
    input.totalCents > 0
      ? [{ amountCents: input.totalCents, paidByUserId: null }]
      : [],
  );
  const shares =
    input.frozenShares ??
    (input.redistribute
      ? suggestCapacity(members, result.shares)?.shares
      : null) ??
    result.shares;
  const incomeCents = safeCents(
    members.reduce((sum, member) => sum + BigInt(member.incomeCents), 0n),
  );
  return {
    incomeCents,
    remainingCents: safeCents(BigInt(incomeCents) - BigInt(input.totalCents)),
    members: members.map((member) => ({
      ...member,
      shareCents: shares[member.userId]!,
      remainingCents: safeCents(
        BigInt(member.incomeCents) - BigInt(shares[member.userId]!),
      ),
    })),
  };
}

export function summarizeHistory(
  rows: { incomeCents: number; expenseCents: number; remainingCents: number }[],
) {
  const sum = (key: keyof (typeof rows)[number]) =>
    safeCents(rows.reduce((total, row) => total + BigInt(row[key]), 0n));
  const incomeCents = sum('incomeCents');
  const expenseCents = sum('expenseCents');
  const remainingCents = sum('remainingCents');
  return {
    incomeCents,
    expenseCents,
    remainingCents,
    averageExpenseCents: rows.length
      ? safeCents(BigInt(expenseCents) / BigInt(rows.length))
      : 0,
    averageRemainingCents: rows.length
      ? safeCents(BigInt(remainingCents) / BigInt(rows.length))
      : 0,
    count: rows.length,
  };
}

/** Cenário sem rendimento: só compromete uma fração da sobra positiva. */
export function reserveScenario(
  remainingCents: number,
  percent: number,
  expenseCents: number,
) {
  if (
    !Number.isSafeInteger(remainingCents) ||
    !Number.isSafeInteger(expenseCents) ||
    expenseCents < 0 ||
    !Number.isInteger(percent) ||
    percent < 0 ||
    percent > 100
  )
    throw new Error('Cenário inválido.');
  const contributionCents = safeCents(
    (BigInt(Math.max(0, remainingCents)) * BigInt(percent)) / 100n,
  );
  const targetCents = safeCents(BigInt(expenseCents) * 6n);
  return {
    contributionCents,
    annualCents: safeCents(BigInt(contributionCents) * 12n),
    targetCents,
    monthsToTarget:
      contributionCents > 0 && targetCents > 0
        ? safeCents(
            (BigInt(targetCents) + BigInt(contributionCents) - 1n) /
              BigInt(contributionCents),
          )
        : null,
  };
}
