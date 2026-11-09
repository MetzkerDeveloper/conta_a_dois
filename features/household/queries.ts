import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth, isAuthConfigured } from '@/lib/auth';
import { getDb } from '@/db';
import { safeReturnPath } from '@/lib/security/redirect';
import { getHouseholdForUser } from './service';

export async function requireUser(returnPath = '/casal') {
  if (!isAuthConfigured()) redirect('/login');
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified)
    redirect(`/login?next=${encodeURIComponent(safeReturnPath(returnPath))}`);
  return session.user;
}

export async function requireHousehold() {
  const user = await requireUser();
  const household = await getHouseholdForUser(getDb(), user.id);
  if (!household) redirect('/comecar');
  return { user, household, householdId: household.id };
}
