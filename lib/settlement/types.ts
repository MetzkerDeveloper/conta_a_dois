export type Member = { userId: string; incomeCents: number };
export type Rule = {
  mode: 'fixed' | 'equal' | 'proportional';
  higherShareBps: number;
  tiebreakUserId?: string;
};
export type Expense = { amountCents: number; paidByUserId: string | null };
export type Result = {
  totalCents: number;
  shares: Record<string, number>;
  paid: Record<string, number>;
  balances: Record<string, number>;
  transfer: { from: string; to: string; amountCents: number } | null;
  unpaidCents: number;
};
