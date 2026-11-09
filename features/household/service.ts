import { and, count, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '@/db';
import {
  categories,
  householdMembers,
  households,
  invites,
  user,
} from '@/db/schema';
import { defaultCategories } from '@/db/default-categories';
import {
  createInviteToken,
  hashInviteToken,
  isInviteToken,
} from '@/lib/security/invite-token';
import {
  PRIVACY_VERSION,
  createHouseholdSchema,
  acceptInviteSchema,
} from './schema';
import type { z } from 'zod';

export class HouseholdError extends Error {}
const invalidInvite = () =>
  new HouseholdError(
    'Este convite expirou, já foi usado ou não está mais disponível. Peça um novo link.',
  );

export async function getHouseholdForUser(db: Database, userId: string) {
  const [membership] = await db
    .select({ household: households, membership: householdMembers })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .limit(1);
  if (!membership) return null;
  const members = await db
    .select({
      userId: householdMembers.userId,
      displayName: householdMembers.displayName,
      slot: householdMembers.slot,
    })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, membership.household.id))
    .orderBy(householdMembers.slot);
  return { ...membership.household, members };
}

export async function createHousehold(
  db: Database,
  userId: string,
  input: z.infer<typeof createHouseholdSchema>,
) {
  input = createHouseholdSchema.parse(input);
  return db.transaction(async (tx) => {
    // Mesmo lock na criação e no aceite impede o usuário de entrar em dois casais.
    const [actor] = await tx
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .for('update');
    if (!actor?.emailVerified)
      throw new HouseholdError(
        'Confirme seu acesso pelo e-mail antes de continuar.',
      );
    const [existing] = await tx
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);
    if (existing) throw new HouseholdError('Você já faz parte de um casal.');
    const [household] = await tx
      .insert(households)
      .values({
        name: input.name,
        splitMode: input.splitMode,
        higherShareBps: input.higherShareBps,
        transferDay: input.transferDay,
      })
      .returning();
    await tx.insert(householdMembers).values({
      householdId: household!.id,
      userId,
      displayName: input.displayName,
      slot: 1,
    });
    await tx.insert(categories).values(
      defaultCategories.map((category) => ({
        ...category,
        householdId: household!.id,
      })),
    );
    await tx
      .update(user)
      .set({
        consentedAt: sql`clock_timestamp()`,
        privacyVersion: PRIVACY_VERSION,
      })
      .where(eq(user.id, userId));
    return household!;
  });
}

export async function createHouseholdInvite(db: Database, userId: string) {
  return db.transaction(async (tx) => {
    const [actor] = await tx
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .for('update');
    if (!actor?.emailVerified)
      throw new HouseholdError(
        'Confirme seu acesso pelo e-mail antes de continuar.',
      );
    const [membership] = await tx
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);
    if (!membership)
      throw new HouseholdError('Crie seu casal antes de gerar um convite.');
    await tx
      .select()
      .from(households)
      .where(eq(households.id, membership.householdId))
      .for('update');
    const [size] = await tx
      .select({ count: count() })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, membership.householdId));
    if (size!.count !== 1)
      throw new HouseholdError('O casal já tem dois membros.');
    // Há apenas um link ativo. Gerar outro revoga o anterior na mesma transação.
    await tx
      .update(invites)
      .set({ revokedAt: sql`clock_timestamp()` })
      .where(
        and(
          eq(invites.householdId, membership.householdId),
          isNull(invites.acceptedAt),
          isNull(invites.revokedAt),
        ),
      );
    const token = createInviteToken();
    const [invite] = await tx
      .insert(invites)
      .values({
        householdId: membership.householdId,
        tokenHash: hashInviteToken(token),
        createdBy: userId,
        expiresAt: sql`clock_timestamp() + interval '7 days'`,
      })
      .returning({ expiresAt: invites.expiresAt });
    return { token, expiresAt: invite!.expiresAt };
  });
}

// Somente chamado após autenticar. O token é a autorização para ver este convite.
export async function getInvitePreview(db: Database, token: string) {
  if (!isInviteToken(token)) return null;
  const [invite] = await db
    .select({ householdName: households.name })
    .from(invites)
    .innerJoin(households, eq(households.id, invites.householdId))
    .where(
      and(
        eq(invites.tokenHash, hashInviteToken(token)),
        isNull(invites.acceptedAt),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, sql`clock_timestamp()`),
      ),
    )
    .limit(1);
  return invite ?? null;
}

export async function acceptHouseholdInvite(
  db: Database,
  userId: string,
  input: z.infer<typeof acceptInviteSchema>,
) {
  input = acceptInviteSchema.parse(input);
  if (!isInviteToken(input.token)) throw invalidInvite();
  return db.transaction(async (tx) => {
    const [actor] = await tx
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .for('update');
    if (!actor?.emailVerified)
      throw new HouseholdError(
        'Confirme seu acesso pelo e-mail antes de continuar.',
      );
    const [existing] = await tx
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);
    if (existing) throw new HouseholdError('Você já faz parte de um casal.');
    const hash = hashInviteToken(input.token);
    const [candidate] = await tx
      .select({ householdId: invites.householdId })
      .from(invites)
      .where(eq(invites.tokenHash, hash))
      .limit(1);
    if (!candidate) throw invalidInvite();
    // Todos os aceites e a rotação de links disputam o mesmo lock do casal.
    await tx
      .select()
      .from(households)
      .where(eq(households.id, candidate.householdId))
      .for('update');
    const [invite] = await tx
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.householdId, candidate.householdId),
          eq(invites.tokenHash, hash),
          isNull(invites.acceptedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, sql`clock_timestamp()`),
        ),
      )
      .for('update');
    if (!invite || invite.createdBy === userId) throw invalidInvite();
    const [size] = await tx
      .select({ count: count() })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, invite.householdId));
    if (size!.count !== 1) throw invalidInvite();
    await tx.insert(householdMembers).values({
      householdId: invite.householdId,
      userId,
      displayName: input.displayName,
      slot: 2,
    });
    await tx
      .update(invites)
      .set({ acceptedAt: sql`clock_timestamp()`, acceptedBy: userId })
      .where(
        and(
          eq(invites.id, invite.id),
          eq(invites.householdId, invite.householdId),
        ),
      );
    await tx
      .update(user)
      .set({
        consentedAt: sql`clock_timestamp()`,
        privacyVersion: PRIVACY_VERSION,
      })
      .where(eq(user.id, userId));
    return invite.householdId;
  });
}
