export function currentMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(now);
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}`;
}

export function shiftMonth(month: string, offset: number): string {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year!, number! - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00Z`));
}

export function transferDate(month: string, day: number): string {
  const [year, number] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year!, number!, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export function inputMoney(cents: number): string {
  const value = BigInt(cents);
  return `${value / 100n},${(value % 100n).toString().padStart(2, '0')}`;
}
