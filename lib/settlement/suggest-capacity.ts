import type { Member } from './types';

function safe(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || value < 0n)
    throw new Error('Valor excede o limite seguro.');
  return result;
}

/** Simula contribuições limitadas à renda, sem alterar cotas ou pagamentos. */
export function suggestCapacity(
  members: [Member, Member],
  shares: Record<string, number>,
) {
  if (members.length !== 2 || members[0].userId === members[1].userId)
    throw new Error('Informe dois membros distintos.');
  for (const member of members) {
    if (
      !member.userId ||
      !Number.isSafeInteger(member.incomeCents) ||
      member.incomeCents < 0 ||
      !Number.isSafeInteger(shares[member.userId]) ||
      shares[member.userId]! < 0
    )
      throw new Error(
        'Rendas e cotas devem ser inteiros seguros não negativos.',
      );
  }
  const contributions = members.map((member) => {
    const share = BigInt(shares[member.userId]!);
    const income = BigInt(member.incomeCents);
    return {
      userId: member.userId,
      income,
      share,
      suggested: share < income ? share : income,
    };
  });
  let shortage = contributions.reduce(
    (sum, item) => sum + item.share - item.suggested,
    0n,
  );
  if (shortage === 0n) return null;
  const excessCents = safe(shortage);
  for (const item of contributions) {
    const room = item.income - item.suggested;
    const extra = room < shortage ? room : shortage;
    item.suggested += extra;
    shortage -= extra;
  }
  const adjustedShares = { ...shares };
  for (const item of contributions) {
    if (item.suggested > item.share) {
      const donor = contributions.find(
        (candidate) => candidate.userId !== item.userId,
      )!;
      const moved = item.suggested - item.share;
      adjustedShares[item.userId] = safe(item.suggested);
      adjustedShares[donor.userId] = safe(donor.share - moved);
    }
  }
  return {
    originalShares: { ...shares },
    shares: adjustedShares,
    contributions: Object.fromEntries(
      contributions.map((item) => [item.userId, safe(item.suggested)]),
    ),
    redistributedCents: safe(BigInt(excessCents) - shortage),
    uncoveredCents: safe(shortage),
  };
}
