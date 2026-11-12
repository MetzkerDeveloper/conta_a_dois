'use server';

import { headers } from 'next/headers';
import { getDb } from '@/db';
import { getAuth } from '@/lib/auth';
import { safeReturnPath } from '@/lib/security/redirect';
import { preparePasswordSetup } from './service';

export async function preparePasswordLogin(
  email: string,
  returnPath = '/casal',
): Promise<boolean> {
  return preparePasswordSetup(getDb(), email, async (normalized) => {
    await getAuth().api.requestPasswordReset({
      headers: await headers(),
      body: {
        email: normalized,
        redirectTo: `/senha?next=${encodeURIComponent(safeReturnPath(returnPath))}`,
      },
    });
  });
}
