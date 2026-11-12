import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '@/db';
import { account, user } from '@/db/schema';
import { consumeActionLimit } from '@/lib/security/action-rate-limit';

export async function preparePasswordSetup(
  db: Database,
  raw: string,
  requestReset: (email: string) => Promise<unknown>,
): Promise<boolean> {
  const email = z.email().max(254).parse(raw).toLowerCase();
  const key = createHash('sha256').update(email).digest('hex');
  if (!(await consumeActionLimit(db, `password-setup:${key}`, 3, 600)))
    return false;
  const [credential] = await db
    .select({ password: account.password })
    .from(user)
    .leftJoin(
      account,
      and(eq(account.userId, user.id), eq(account.providerId, 'credential')),
    )
    .where(eq(user.email, email))
    .limit(1);
  if (credential?.password) return false;
  await requestReset(email);
  return true;
}
