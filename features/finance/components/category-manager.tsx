'use client';

import { useActionState } from 'react';
import {
  saveCategoryAction,
  toggleCategoryAction,
  type CategoryActionState,
} from '../category-actions';
import type { MonthlyFinance } from '../service';

type Category = MonthlyFinance['categories'][number];

function Feedback({ state }: { state: CategoryActionState }) {
  return state.error ? (
    <p className="field-error" role="alert">
      {state.error}
    </p>
  ) : state.message ? (
    <p className="notice" role="status">
      {state.message}
    </p>
  ) : null;
}

function CategoryEditor({ category }: { category?: Category }) {
  const [state, action, pending] = useActionState(saveCategoryAction, {});
  const id = `category-${category?.id ?? 'new'}`;
  return (
    <form action={action} className="category-editor">
      {category && <input type="hidden" name="id" value={category.id} />}
      <div>
        <label htmlFor={`${id}-name`}>Nome</label>
        <input
          id={`${id}-name`}
          name="name"
          defaultValue={category?.name}
          maxLength={40}
          placeholder="Ex.: Pets"
          required
        />
      </div>
      <div>
        <label htmlFor={`${id}-color`}>Cor</label>
        <input
          id={`${id}-color`}
          type="color"
          name="color"
          defaultValue={category?.color ?? '#286351'}
          className="category-color-input"
          title="Selecionar cor da categoria"
        />
      </div>
      <button className="button secondary" type="submit" disabled={pending}>
        {pending
          ? 'Salvando…'
          : category
            ? 'Salvar alterações'
            : 'Criar categoria'}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function CategoryStatus({ category }: { category: Category }) {
  const [state, action, pending] = useActionState(toggleCategoryAction, {});
  return (
    <form action={action} className="category-status-form">
      <input type="hidden" name="id" value={category.id} />
      <input type="hidden" name="active" value={String(!category.active)} />
      <button className="text-link" type="submit" disabled={pending}>
        {category.active ? 'Arquivar' : 'Reativar'}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const active = categories.filter((category) => category.active);
  const archived = categories.filter((category) => !category.active);
  return (
    <div className="category-manager">
      <p className="muted">
        Categorias ativas aparecem nos novos lançamentos. Arquivar preserva o
        histórico; categorias usadas por recorrências ativas precisam ser
        pausadas primeiro.
      </p>
      <CategoryEditor />
      <ul className="category-list">
        {active.map((category) => (
          <li key={category.id}>
            <span
              className="category-swatch"
              style={{ backgroundColor: category.color }}
            />
            <CategoryEditor category={category} />
            <CategoryStatus category={category} />
          </li>
        ))}
      </ul>
      {archived.length > 0 && (
        <details>
          <summary>Categorias arquivadas ({archived.length})</summary>
          <ul className="category-list">
            {archived.map((category) => (
              <li key={category.id}>
                <span
                  className="category-swatch"
                  style={{ backgroundColor: category.color }}
                />
                <CategoryEditor category={category} />
                <CategoryStatus category={category} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
