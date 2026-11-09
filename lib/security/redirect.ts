export function safeReturnPath(value: unknown): string {
  if (typeof value === 'string' && /^\/convite\/[a-f0-9]{64}$/.test(value))
    return value;
  return '/casal';
}
