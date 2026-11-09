import { createHash, randomBytes } from 'node:crypto';

export function createInviteToken(): string {
  return randomBytes(32).toString('hex');
}
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function isInviteToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token);
}
