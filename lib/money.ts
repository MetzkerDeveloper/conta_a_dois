const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents))
    throw new Error('Valor monetário inválido.');
  const value = BigInt(cents);
  const absolute = value < 0n ? -value : value;
  const formatted = brl
    .formatToParts(absolute / 100n)
    .map((part) => {
      if (part.type === 'fraction')
        return (absolute % 100n).toString().padStart(2, '0');
      return part.value;
    })
    .join('');
  return cents < 0 ? `-${formatted}` : formatted;
}

/** Aceita 1234,56 ou 1.234,56; não aceita notação decimal americana. */
export function parseMoney(input: string): number {
  const normalized = input.trim();
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized)) {
    throw new Error('Informe um valor como 1.234,56.');
  }
  const negative = normalized.startsWith('-');
  const [whole, fraction = ''] = normalized
    .replace(/^-/, '')
    .replace(/\./g, '')
    .split(',');
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  const result = Number(negative ? -cents : cents);
  if (!Number.isSafeInteger(result))
    throw new Error('Valor excede o limite seguro.');
  return result;
}
