'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import type { ExtraIncomeEntry } from '@/db/schema';
import { inputMoney, monthLabel } from '../month';

type ExtraFields = {
  entries: { id: string; description: string; amount: string }[];
};

export function ExtraIncomeFields({
  entries,
  month,
  disabled,
}: {
  entries: ExtraIncomeEntry[];
  month: string;
  disabled: boolean;
}) {
  const { control, register } = useForm<ExtraFields>({
    defaultValues: {
      entries: entries.map((entry) => ({
        id: entry.id,
        description: entry.description,
        amount: inputMoney(entry.amountCents),
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'entries',
    keyName: 'fieldKey',
  });
  return (
    <section aria-labelledby="extra-incomes-heading">
      <h3 id="extra-incomes-heading">Rendas extras do mês</h3>
      <p className="form-note muted">
        Adicione cada recebimento de {monthLabel(month)} separadamente. Os
        extras não se repetem nos próximos meses.
      </p>
      <div className="extra-income-list">
        {fields.map((field, index) => (
          <fieldset
            className="extra-income-item"
            key={field.fieldKey}
            disabled={disabled}
          >
            <legend>Renda extra {index + 1}</legend>
            <input type="hidden" {...register(`entries.${index}.id`)} />
            <label htmlFor={`extra-description-${field.id}`}>
              Descrição (opcional)
            </label>
            <input
              id={`extra-description-${field.id}`}
              maxLength={120}
              placeholder="Ex.: trabalho avulso, bônus"
              {...register(`entries.${index}.description`)}
            />
            <label htmlFor={`extra-amount-${field.id}`}>
              Valor da renda extra {index + 1} (R$)
            </label>
            <input
              id={`extra-amount-${field.id}`}
              inputMode="decimal"
              maxLength={30}
              placeholder="0,00"
              required
              {...register(`entries.${index}.amount`)}
            />
            <button
              className="button secondary"
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remover renda extra ${index + 1}`}
            >
              <Trash2 size={16} /> Remover
            </button>
          </fieldset>
        ))}
      </div>
      {fields.length === 0 && (
        <p className="form-note muted">
          Nenhuma renda extra cadastrada neste mês.
        </p>
      )}
      <button
        className="button secondary"
        type="button"
        disabled={disabled || fields.length >= 50}
        onClick={() =>
          append({ id: crypto.randomUUID(), description: '', amount: '' })
        }
      >
        <Plus size={16} /> Adicionar renda extra
      </button>
      {fields.length >= 50 && (
        <p className="form-note muted">Limite de 50 rendas extras neste mês.</p>
      )}
    </section>
  );
}
