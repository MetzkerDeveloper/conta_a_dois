export function safeReturnPath(value: unknown): string {
  if (value === '/perfil') return value;
  if (typeof value === 'string' && /^\/convite\/[a-f0-9]{64}$/.test(value))
    return value;
  return '/casal';
}
