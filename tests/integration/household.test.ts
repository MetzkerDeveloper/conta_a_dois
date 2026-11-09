import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createAuth } from '@/lib/auth-factory';
import { consumeActionLimit } from '@/lib/security/action-rate-limit';
import { hashInviteToken } from '@/lib/security/invite-token';
import {
  createHousehold,
  createHouseholdInvite,
  acceptHouseholdInvite,
  getHouseholdForUser,
  getInvitePreview,
} from '@/features/household/service';

const connectionString = process.env.TEST_DATABASE_URL;
if (
  !connectionString ||
  !new URL(connectionString).pathname.endsWith('_test')
) {
  throw new Error(
    'Configure TEST_DATABASE_URL com um banco isolado cujo nome termine em _test.',
  );
}
const pool = new Pool({
  connectionString,
  max: 8,
  connectionTimeoutMillis: 5000,
});
const db = drizzle({ client: pool, schema });
beforeAll(async () => {
  await migrate(db, { migrationsFolder: './db/migrations' });
});
afterAll(async () => {
  await pool.end();
});

async function person(name = 'Pessoa', verified = true) {
  const id = randomUUID();
  await db
    .insert(schema.user)
    .values({ id, name, email: `${id}@example.test`, emailVerified: verified });
  return id;
}
const householdInput = {
  name: 'Nossa casa',
  displayName: 'Ana',
  splitMode: 'fixed' as const,
  higherShareBps: 7000,
  transferDay: 25,
  consent: true as const,
};
const accept = (token: string, displayName = 'Bruno') => ({
  token,
  displayName,
  consent: true as const,
});
async function householdFixture() {
  const owner = await person('Ana');
  const household = await createHousehold(db, owner, householdInput);
  return { owner, household };
}

describe('casal e convites no Postgres', () => {
  it('persiste o casal, a regra e o registro de concordância', async () => {
    const { owner, household } = await householdFixture();
    const result = await getHouseholdForUser(db, owner);
    expect(result).toMatchObject({
      id: household.id,
      higherShareBps: 7000,
      transferDay: 25,
      members: [{ userId: owner, slot: 1 }],
    });
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, owner));
    expect(user!.consentedAt).toBeInstanceOf(Date);
    expect(user!.privacyVersion).toBe('2026-11-09');
  });
  it('isola consultas de casais diferentes e não aceita IDs de casal para autorização', async () => {
    const first = await householdFixture();
    const second = await householdFixture();
    const stranger = await person();
    expect(await getHouseholdForUser(db, stranger)).toBeNull();
    expect((await getHouseholdForUser(db, first.owner))!.id).toBe(
      first.household.id,
    );
    expect(
      (await getHouseholdForUser(db, second.owner))!.members.map(
        (m) => m.userId,
      ),
    ).not.toContain(first.owner);
    await expect(createHouseholdInvite(db, stranger)).rejects.toThrow(
      'Crie seu casal',
    );
  });
  it('armazena só o hash e revoga o convite anterior', async () => {
    const { owner } = await householdFixture();
    const first = await createHouseholdInvite(db, owner);
    const second = await createHouseholdInvite(db, owner);
    const [stored] = await db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.tokenHash, hashInviteToken(second.token)));
    expect(stored!.tokenHash).not.toBe(second.token);
    expect(await getInvitePreview(db, first.token)).toBeNull();
    expect(await getInvitePreview(db, second.token)).toMatchObject({
      householdName: 'Nossa casa',
    });
    expect(second.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      6 * 24 * 60 * 60 * 1000,
    );
  });
  it('aceita uma vez e bloqueia reutilização e terceiro membro', async () => {
    const { owner, household } = await householdFixture();
    const partner = await person('Bruno');
    const stranger = await person();
    const { token } = await createHouseholdInvite(db, owner);
    expect(await acceptHouseholdInvite(db, partner, accept(token))).toBe(
      household.id,
    );
    expect((await getHouseholdForUser(db, partner))!.members).toHaveLength(2);
    await expect(
      acceptHouseholdInvite(db, stranger, accept(token)),
    ).rejects.toThrow('convite');
    await expect(createHouseholdInvite(db, owner)).rejects.toThrow(
      'dois membros',
    );
    expect(await getInvitePreview(db, token)).toBeNull();
    const [stored] = await db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.tokenHash, hashInviteToken(token)));
    expect(stored!.acceptedBy).toBe(partner);
  });
  it('rejeita convite expirado e não cria vínculo', async () => {
    const { owner } = await householdFixture();
    const partner = await person();
    const { token } = await createHouseholdInvite(db, owner);
    await db
      .update(schema.invites)
      .set({ expiresAt: new Date(0) })
      .where(eq(schema.invites.tokenHash, hashInviteToken(token)));
    await expect(
      acceptHouseholdInvite(db, partner, accept(token)),
    ).rejects.toThrow('convite');
    expect(await getHouseholdForUser(db, partner)).toBeNull();
  });
  it('serializa dois aceites simultâneos e reserva somente a segunda vaga', async () => {
    const { owner } = await householdFixture();
    const [one, two] = await Promise.all([person(), person()]);
    const { token } = await createHouseholdInvite(db, owner);
    const results = await Promise.allSettled([
      acceptHouseholdInvite(db, one, accept(token)),
      acceptHouseholdInvite(db, two, accept(token)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await getHouseholdForUser(db, owner))!.members).toHaveLength(2);
  });
  it('impede o mesmo usuário de aceitar convites de dois casais simultaneamente', async () => {
    const first = await householdFixture();
    const second = await householdFixture();
    const partner = await person();
    const a = await createHouseholdInvite(db, first.owner);
    const b = await createHouseholdInvite(db, second.owner);
    const results = await Promise.allSettled([
      acceptHouseholdInvite(db, partner, accept(a.token)),
      acceptHouseholdInvite(db, partner, accept(b.token)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('impede duas criações simultâneas e exige e-mail verificado', async () => {
    const owner = await person();
    const results = await Promise.allSettled([
      createHousehold(db, owner, householdInput),
      createHousehold(db, owner, householdInput),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const unverified = await person('Não confirmado', false);
    await expect(
      createHousehold(db, unverified, householdInput),
    ).rejects.toThrow('e-mail');
  });
  it('protege o limite de membros também por constraints do banco', async () => {
    const { household } = await householdFixture();
    const outsider = await person();
    await expect(
      db.insert(schema.householdMembers).values({
        householdId: household.id,
        userId: outsider,
        displayName: 'Terceiro',
        slot: 3,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.householdMembers).values({
        householdId: household.id,
        userId: outsider,
        displayName: 'Duplicado',
        slot: 1,
      }),
    ).rejects.toThrow();
  });
  it('aplica limite de tentativas atômico e renova a janela expirada', async () => {
    const key = `test:${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeActionLimit(db, key, 3, 60)),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
    await db
      .update(schema.actionRateLimits)
      .set({ windowStartedAt: new Date(0) })
      .where(eq(schema.actionRateLimits.key, key));
    expect(await consumeActionLimit(db, key, 3, 60)).toBe(true);
  });
});

describe('Better Auth real com entrega de e-mail capturada em memória', () => {
  beforeEach(async () => {
    await db.delete(schema.rateLimit);
  });
  it('rejeita origem externa e valida o formulário também no servidor', async () => {
    let deliveries = 0;
    const auth = createAuth({
      db,
      secret: 'test-secret-with-more-than-32-characters-only-local',
      baseURL: 'https://contas.example.test',
      sendMagicLink: async () => {
        deliveries++;
      },
    });
    const request = (origin: string, email: string) =>
      auth.handler(
        new Request('https://contas.example.test/api/auth/sign-in/magic-link', {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify({ email, name: 'Ana', callbackURL: '/casal' }),
        }),
      );
    expect(
      (await request('https://fora.example.test', 'ana@example.test')).status,
    ).toBe(403);
    expect(
      (await request('https://contas.example.test', 'invalido')).status,
    ).toBe(400);
    expect(deliveries).toBe(0);
  });
  it('emite cookie seguro sob HTTPS e rejeita link expirado', async () => {
    const email = `${randomUUID()}@example.test`;
    let deliveredURL = '';
    const auth = createAuth({
      db,
      secret: 'test-secret-with-more-than-32-characters-only-local',
      baseURL: 'https://contas.example.test',
      sendMagicLink: async (message) => {
        deliveredURL = message.url;
      },
    });
    const send = () =>
      auth.handler(
        new Request('https://contas.example.test/api/auth/sign-in/magic-link', {
          method: 'POST',
          headers: {
            origin: 'https://contas.example.test',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ email, name: 'Ana', callbackURL: '/casal' }),
        }),
      );
    expect((await send()).status).toBe(200);
    const response = await auth.handler(new Request(deliveredURL));
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith('__Secure-better-auth.session_token='));
    expect(cookie).toMatch(/; Secure/i);
    expect((await send()).status).toBe(200);
    const records = await db.select().from(schema.verification);
    const pending = records.find((record) => record.value.includes(email))!;
    await db
      .update(schema.verification)
      .set({ expiresAt: new Date(0) })
      .where(eq(schema.verification.id, pending.id));
    const expired = await auth.handler(new Request(deliveredURL));
    expect(expired.headers.get('set-cookie') ?? '').not.toContain(
      'session_token=',
    );
  });
  it('emite link com hash, autentica, bloqueia replay, valida sessão e encerra acesso', async () => {
    const email = `${randomUUID()}@example.test`;
    let deliveredURL = '';
    const auth = createAuth({
      db,
      secret: 'test-secret-with-more-than-32-characters-only-local',
      baseURL: 'http://localhost:3000',
      sendMagicLink: async (message) => {
        deliveredURL = message.url;
      },
    });
    const send = () =>
      auth.handler(
        new Request('http://localhost:3000/api/auth/sign-in/magic-link', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
          },
          body: JSON.stringify({
            email,
            name: 'Ana de teste',
            callbackURL: '/casal',
          }),
        }),
      );
    const request = await send();
    expect(request.status).toBe(200);
    const url = new URL(deliveredURL);
    const token = url.searchParams.get('token')!;
    const records = await db.select().from(schema.verification);
    expect(records.some((record) => record.identifier === token)).toBe(false);
    const response = await auth.handler(new Request(deliveredURL));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/casal',
    );
    const setCookies = response.headers.getSetCookie();
    const sessionCookie = setCookies.find((cookie) =>
      cookie.startsWith('better-auth.session_token='),
    )!;
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
    const cookie = sessionCookie.split(';')[0]!;
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    expect(session?.user.email).toBe(email);
    expect(session?.user.emailVerified).toBe(true);
    const replay = await auth.handler(new Request(deliveredURL));
    expect(replay.headers.get('set-cookie') ?? '').not.toContain(
      'session_token=',
    );
    const signOut = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-out', {
        method: 'POST',
        headers: {
          cookie,
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: '{}',
      }),
    );
    expect(signOut.status).toBe(200);
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie }) }),
    ).toBeNull();
    // Limite persistido em banco e aplicado pelo handler HTTP, sem memória local.
    await send();
    await send();
    expect((await send()).status).toBe(429);
    // Nem um payload extra de household_id transforma o login em vínculo de casal.
    const [signedInUser] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email));
    expect(await getHouseholdForUser(db, signedInUser!.id)).toBeNull();
  });
});
