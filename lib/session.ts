import 'server-only';
import { headers } from 'next/headers';
import { getAuth } from './auth';
import { verifySession } from './security/session-errors';

export async function getSession() {
  const requestHeaders = await headers();
  return verifySession(() =>
    getAuth().api.getSession({ headers: requestHeaders }),
  );
}
