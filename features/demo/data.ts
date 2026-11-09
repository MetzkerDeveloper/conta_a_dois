import type { Member, Rule } from '@/lib/settlement/types';

export const DEMO_MONTH = '2026-11';
export const members: [Member & { name: string }, Member & { name: string }] = [
  { userId: 'ana', name: 'Ana', incomeCents: 700000 },
  { userId: 'bruno', name: 'Bruno', incomeCents: 300000 },
];
export const initialRule: Rule = { mode: 'fixed', higherShareBps: 7000 };
export type DemoExpense = {
  id: string;
  description: string;
  amountCents: number;
  category: string;
  dueDate: string;
  paidByUserId: string | null;
};
export const categories = [
  'Moradia',
  'Alimentação',
  'Serviços',
  'Transporte',
  'Outros',
];
export const initialExpenses: DemoExpense[] = [
  {
    id: '1',
    description: 'Aluguel',
    amountCents: 240000,
    category: 'Moradia',
    dueDate: '2026-11-05',
    paidByUserId: 'ana',
  },
  {
    id: '2',
    description: 'Compras do mês',
    amountCents: 85000,
    category: 'Alimentação',
    dueDate: '2026-11-08',
    paidByUserId: 'ana',
  },
  {
    id: '3',
    description: 'Energia elétrica',
    amountCents: 24500,
    category: 'Serviços',
    dueDate: '2026-11-12',
    paidByUserId: 'ana',
  },
  {
    id: '4',
    description: 'Internet',
    amountCents: 13000,
    category: 'Serviços',
    dueDate: '2026-11-15',
    paidByUserId: 'ana',
  },
  {
    id: '5',
    description: 'Transporte',
    amountCents: 37500,
    category: 'Transporte',
    dueDate: '2026-11-20',
    paidByUserId: 'ana',
  },
];
