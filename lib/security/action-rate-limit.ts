import { sql } from 'drizzle-orm';
import type { Database } from '@/db';
import { actionRateLimits } from '@/db/schema';

// Upsert atômico; não depende da memória de uma instância serverless.
export async function consumeActionLimit(
  db: Database,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const expired = sql`${actionRateLimits.windowStartedAt} <= clock_timestamp() - make_interval(secs => ${windowSeconds})`;
  const [row] = await db
    .insert(actionRateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: actionRateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${actionRateLimits.count} + 1 end`,
        windowStartedAt: sql`case when ${expired} then clock_timestamp() else ${actionRateLimits.windowStartedAt} end`,
      },
    })
    .returning({ count: actionRateLimits.count });
  return row!.count <= max;
}
