'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { eq, inArray } from 'drizzle-orm';
import {
  financialMonths,
  householdMembers,
  households,
  user as users,
} from '@/db/schema';
import { consumeActionLimit } from '@/lib/security/action-rate-limit';
import { requireUser } from './queries';
import { createHouseholdSchema, acceptInviteSchema } from './schema';
import {
  acceptHouseholdInvite,
  createHousehold,
  createHouseholdInvite,
  HouseholdError,
} from './service';

export type ActionState = {
  error?: string;
  inviteURL?: string;
  expiresAt?: string;
};
const message = (error: unknown) =>
  error instanceof HouseholdError
    ? error.message
    : 'Não foi possível salvar agora. Tente novamente em instantes.';

export async function createHouseholdAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createHouseholdSchema.safeParse({
    name: form.get('name'),
    displayName: form.get('displayName'),
    splitMode: form.get('splitMode'),
    higherShareBps: Number(form.get('higherShareBps')),
    transferDay: Number(form.get('transferDay')),
    consent: form.get('consent') === 'on',
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Confira os campos.' };
  try {
    const db = getDb();
    if (!(await consumeActionLimit(db, `household:create:${user.id}`, 5, 3600)))
      return {
        error: 'Você tentou muitas vezes. Aguarde uma hora e tente de novo.',
      };
    await createHousehold(db, user.id, parsed.data);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath('/casal');
  redirect('/casal');
}

export async function createInviteAction(): Promise<ActionState> {
  const user = await requireUser();
  try {
    const db = getDb();
    if (!(await consumeActionLimit(db, `invite:create:${user.id}`, 10, 3600)))
      return {
        error:
          'Você já gerou muitos links. Aguarde uma hora para tentar novamente.',
      };
    const invite = await createHouseholdInvite(db, user.id);
    const inviteURL = new URL(
      `/convite/${invite.token}`,
      process.env.AUTH_URL!,
    ).toString();
    return { inviteURL, expiresAt: invite.expiresAt.toISOString() };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function acceptInviteAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const rawToken = form.get('token');
  const user = await requireUser(
    typeof rawToken === 'string' ? `/convite/${rawToken}` : '/casal',
  );
  const parsed = acceptInviteSchema.safeParse({
    token: rawToken,
    displayName: form.get('displayName'),
    consent: form.get('consent') === 'on',
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Confira os campos.' };
  try {
    const db = getDb();
    if (!(await consumeActionLimit(db, `invite:accept:${user.id}`, 30, 3600)))
      return {
        error:
          'Você tentou muitos convites. Aguarde uma hora e tente novamente.',
      };
    await acceptHouseholdInvite(db, user.id, parsed.data);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath('/casal');
  redirect('/casal');
}

export async function deleteAccountAction(form: FormData): Promise<void> {
  const actor = await requireUser('/casal/ajustes');
  if (form.get('confirmation') !== 'EXCLUIR')
    throw new Error('Digite EXCLUIR para confirmar.');

  await getDb().transaction(async (tx) => {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, actor.id))
      .for('update');
    const memberships = await tx
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(eq(householdMembers.userId, actor.id));
    if (memberships.length) {
      await tx
        .select({ id: households.id })
        .from(households)
        .where(
          inArray(
            households.id,
            memberships.map(({ householdId }) => householdId),
          ),
        )
        .for('update');
      await tx.delete(financialMonths).where(
        inArray(
          financialMonths.householdId,
          memberships.map(({ householdId }) => householdId),
        ),
      );
      await tx.delete(households).where(
        inArray(
          households.id,
          memberships.map(({ householdId }) => householdId),
        ),
      );
    }
    await tx.delete(users).where(eq(users.id, actor.id));
  });
  redirect('/login?conta=excluida');
}
