import 'server-only';
import { redirect } from 'next/navigation';
import { isAuthConfigured } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { getDb } from '@/db';
import { safeReturnPath } from '@/lib/security/redirect';
import { getHouseholdForUser } from './service';

export async function requireUser(returnPath = '/casal') {
  if (!isAuthConfigured()) redirect('/login');
  const session = await getSession();
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
