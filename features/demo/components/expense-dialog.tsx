'use client';

import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import type { z } from 'zod';
import { expenseSchema } from '../schema';
import { categories } from '../data';
import { useDemo } from './demo-provider';

export function ExpenseDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const { addExpense } = useDemo();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<
    z.input<typeof expenseSchema>,
    unknown,
    z.output<typeof expenseSchema>
  >({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      amount: '',
      dueDate: '2026-11-20',
      category: 'Outros',
      paidByUserId: 'ana',
    },
  });
  return (
    <>
      <button
        className="button primary add-expense"
        onClick={() => ref.current?.showModal()}
      >
        <Plus size={18} />
        <span>Nova despesa</span>
      </button>
      <dialog
        ref={ref}
        className="expense-dialog"
        aria-labelledby="expense-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Demonstração</p>
            <h2 id="expense-title">Nova despesa</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Fechar formulário"
            onClick={() => ref.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <form
          noValidate
          onSubmit={(event) => {
            void handleSubmit((data) => {
              addExpense({
                description: data.description,
                amountCents: data.amount,
                dueDate: data.dueDate,
                category: data.category,
                paidByUserId:
                  data.paidByUserId === 'pending' ? null : data.paidByUserId,
              });
              reset();
              ref.current?.close();
            })(event);
          }}
        >
          <label htmlFor="description">Descrição</label>
          <input
            id="description"
            autoFocus
            {...register('description')}
            aria-invalid={!!errors.description}
            aria-describedby={
              errors.description ? 'description-error' : undefined
            }
            placeholder="Ex.: compras da semana"
          />
          {errors.description && (
            <p id="description-error" className="field-error">
              {errors.description.message}
            </p>
          )}
          <div className="form-grid">
            <div>
              <label htmlFor="amount">Valor (R$)</label>
              <input
                id="amount"
                inputMode="decimal"
                {...register('amount')}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? 'amount-error' : undefined}
                placeholder="0,00"
              />
              {errors.amount && (
                <p id="amount-error" className="field-error">
                  {errors.amount.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="dueDate">Vencimento</label>
              <input
                id="dueDate"
                type="date"
                min="2026-11-01"
                max="2026-11-30"
                {...register('dueDate')}
                aria-invalid={!!errors.dueDate}
                aria-describedby={errors.dueDate ? 'date-error' : undefined}
              />
              {errors.dueDate && (
                <p id="date-error" className="field-error">
                  {errors.dueDate.message}
                </p>
              )}
            </div>
          </div>
          <label htmlFor="category">Categoria</label>
          <select id="category" {...register('category')}>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <label htmlFor="payer">Quem pagou?</label>
          <select id="payer" {...register('paidByUserId')}>
            <option value="ana">Ana</option>
            <option value="bruno">Bruno</option>
            <option value="pending">Ainda não foi paga</option>
          </select>
          <p className="muted form-note">
            Os dados desta demonstração são apagados ao recarregar a página.
          </p>
          <button className="button primary full-width" type="submit">
            Adicionar despesa
          </button>
        </form>
      </dialog>
    </>
  );
}
