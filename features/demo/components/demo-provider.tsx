'use client';

import { createContext, useContext, useState } from 'react';
import { calculate } from '@/lib/settlement/calculate';
import {
  initialExpenses,
  initialRule,
  members as initialMembers,
  type DemoExpense,
} from '../data';

function useDemoState() {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [members, setMembers] = useState(initialMembers);
  const [rule, setRule] = useState(initialRule);
  const [notice, setNotice] = useState('');
  const result = calculate(members, rule, expenses);
  function addExpense(expense: Omit<DemoExpense, 'id'>) {
    setExpenses((items) => [...items, { ...expense, id: crypto.randomUUID() }]);
    setNotice('Despesa adicionada à demonstração. O painel foi recalculado.');
  }
  function resetDemo() {
    setExpenses(initialExpenses);
    setMembers(initialMembers);
    setRule(initialRule);
    setNotice('Demonstração restaurada.');
  }
  return {
    expenses,
    setExpenses,
    members,
    setMembers,
    rule,
    setRule,
    result,
    addExpense,
    notice,
    setNotice,
    resetDemo,
  };
}

const DemoContext = createContext<ReturnType<typeof useDemoState> | null>(null);
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const value = useDemoState();
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('DemoProvider ausente.');
  return context;
}
