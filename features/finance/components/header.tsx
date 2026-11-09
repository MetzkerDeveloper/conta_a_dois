import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthLabel, shiftMonth } from '../month';
import { RefreshFinance } from './navigation';
import { RecurringGenerator } from './cycle-forms';

export function FinanceHeader({
  title,
  description,
  month,
  path = '/casal',
}: {
  title: string;
  description: string;
  month: string;
  path?: string;
}) {
  return (
    <>
      <RecurringGenerator key={month} month={month} />
      <div className="page-heading">
        <div>
          <p className="eyebrow">{monthLabel(month)}</p>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
        <RefreshFinance />
      </div>
      <div className="month-toolbar">
        {month > '2000-01' && (
          <Link
            href={`${path}?mes=${shiftMonth(month, -1)}`}
            className="icon-button"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={20} />
          </Link>
        )}
        <form action={path} method="get" className="month-form">
          <label htmlFor="selected-month" className="sr-only">
            Competência
          </label>
          <input
            key={month}
            id="selected-month"
            name="mes"
            type="month"
            defaultValue={month}
            min="2000-01"
            max="2199-12"
            required
          />
          <button className="button secondary" type="submit">
            Ver mês
          </button>
        </form>
        {month < '2199-12' && (
          <Link
            href={`${path}?mes=${shiftMonth(month, 1)}`}
            className="icon-button"
            aria-label="Próximo mês"
          >
            <ChevronRight size={20} />
          </Link>
        )}
      </div>
    </>
  );
}
