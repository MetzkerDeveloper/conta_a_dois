import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  bigint,
  date,
  foreignKey,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';
import type { Result } from '@/lib/settlement/types';

export type MonthSnapshot = {
  version: 1;
  capturedAt: string;
  closedBy: string;
  totalCents: number;
  unpaidCents: number;
  result: Result;
  data: Record<string, unknown>;
};

const time = (name: string) => timestamp(name, { withTimezone: true });

export const settlementStatus = pgEnum('settlement_status', [
  'pending',
  'confirmed',
  'cancelled',
]);

// Chaves do objeto preservam os nomes esperados pelo adapter do Better Auth.
export const user = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: time('created_at').notNull().defaultNow(),
  updatedAt: time('updated_at').notNull().defaultNow(),
  consentedAt: time('consented_at'),
  privacyVersion: text('privacy_version'),
});
export const session = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: time('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('sessions_user_idx').on(table.userId)],
);
export const account = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: time('access_token_expires_at'),
    refreshTokenExpiresAt: time('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('accounts_user_idx').on(table.userId),
    unique('accounts_provider_unique').on(table.providerId, table.accountId),
  ],
);
export const verification = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: time('expires_at').notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
);
export const rateLimit = pgTable('auth_rate_limits', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

export const splitMode = pgEnum('split_mode', [
  'fixed',
  'equal',
  'proportional',
]);
export const households = pgTable(
  'households',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    splitMode: splitMode('split_mode').notNull().default('fixed'),
    higherShareBps: integer('higher_share_bps').notNull().default(7000),
    // IDs dos membros são checados nas ações; nenhuma entrada do cliente autoriza consultas.
    tiebreakUserId: text('tiebreak_user_id').references(() => user.id),
    designatedPayerId: text('designated_payer_id').references(() => user.id),
    transferDay: integer('transfer_day').notNull().default(25),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'households_share_range',
      sql`${table.higherShareBps} between 0 and 10000`,
    ),
    check('households_day_range', sql`${table.transferDay} between 1 and 31`),
  ],
);
export const householdMembers = pgTable(
  'household_members',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    slot: smallint('slot').notNull(),
    joinedAt: time('joined_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.householdId, table.userId] }),
    unique('household_members_user_unique').on(table.userId),
    unique('household_members_slot_unique').on(table.householdId, table.slot),
    check('household_members_two_slots', sql`${table.slot} in (1, 2)`),
  ],
);
export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: time('created_at').notNull().defaultNow(),
    expiresAt: time('expires_at').notNull(),
    acceptedAt: time('accepted_at'),
    acceptedBy: text('accepted_by').references(() => user.id),
    revokedAt: time('revoked_at'),
  },
  (table) => [index('invites_household_idx').on(table.householdId)],
);
export const actionRateLimits = pgTable('action_rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  windowStartedAt: time('window_started_at').notNull().defaultNow(),
});

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#286351'),
    active: boolean('active').notNull().default(true),
  },
  (table) => [
    unique('categories_household_id_unique').on(table.householdId, table.id),
    unique('categories_household_name_unique').on(
      table.householdId,
      table.name,
    ),
  ],
);

// A primeira alteração financeira do mês fixa a regra daquela competência.
export const financialMonths = pgTable(
  'financial_months',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    month: date('month').notNull(),
    splitMode: splitMode('split_mode').notNull(),
    higherShareBps: integer('higher_share_bps').notNull(),
    tiebreakUserId: text('tiebreak_user_id'),
    designatedPayerId: text('designated_payer_id'),
    transferDay: integer('transfer_day').notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    closedAt: time('closed_at'),
    snapshot: jsonb('snapshot').$type<MonthSnapshot>(),
  },
  (table) => [
    primaryKey({ columns: [table.householdId, table.month] }),
    check(
      'financial_months_first_day',
      sql`extract(day from ${table.month}) = 1`,
    ),
    check(
      'financial_months_share_range',
      sql`${table.higherShareBps} between 0 and 10000`,
    ),
    check(
      'financial_months_transfer_day_range',
      sql`${table.transferDay} between 1 and 31`,
    ),
    foreignKey({
      columns: [table.householdId, table.tiebreakUserId],
      foreignColumns: [householdMembers.householdId, householdMembers.userId],
    }),
    foreignKey({
      columns: [table.householdId, table.designatedPayerId],
      foreignColumns: [householdMembers.householdId, householdMembers.userId],
    }),
  ],
);

export const incomes = pgTable(
  'incomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id').notNull(),
    userId: text('user_id').notNull(),
    month: date('month').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    version: integer('version').notNull().default(1),
    confirmedAt: time('confirmed_at').notNull().defaultNow(),
  },
  (table) => [
    unique('incomes_member_month_unique').on(
      table.householdId,
      table.userId,
      table.month,
    ),
    index('incomes_household_month_idx').on(table.householdId, table.month),
    check(
      'incomes_amount_range',
      sql`${table.amountCents} between 0 and 9007199254740991`,
    ),
    check('incomes_version_positive', sql`${table.version} > 0`),
    foreignKey({
      columns: [table.householdId, table.month],
      foreignColumns: [financialMonths.householdId, financialMonths.month],
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.householdId, table.userId],
      foreignColumns: [householdMembers.householdId, householdMembers.userId],
    }),
  ],
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id').notNull(),
    month: date('month').notNull(),
    description: text('description').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    dueDate: date('due_date').notNull(),
    categoryId: uuid('category_id').notNull(),
    paidByUserId: text('paid_by_user_id'),
    paidAt: time('paid_at'),
    createdBy: text('created_by').notNull(),
    notes: text('notes').notNull().default(''),
    creationKey: uuid('creation_key').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    recurringId: uuid('recurring_id'),
  },
  (table) => [
    index('expenses_household_month_due_idx').on(
      table.householdId,
      table.month,
      table.dueDate,
    ),
    index('expenses_household_category_idx').on(
      table.householdId,
      table.categoryId,
    ),
    unique('expenses_creation_unique').on(table.householdId, table.creationKey),
    check(
      'expenses_amount_range',
      sql`${table.amountCents} between 1 and 9007199254740991`,
    ),
    check('expenses_version_positive', sql`${table.version} > 0`),
    check(
      'expenses_payment_consistent',
      sql`(${table.paidByUserId} is null) = (${table.paidAt} is null)`,
    ),
    foreignKey({
      columns: [table.householdId, table.month],
      foreignColumns: [financialMonths.householdId, financialMonths.month],
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.householdId, table.categoryId],
      foreignColumns: [categories.householdId, categories.id],
    }),
    foreignKey({
      columns: [table.householdId, table.paidByUserId],
      foreignColumns: [householdMembers.householdId, householdMembers.userId],
    }),
    foreignKey({
      columns: [table.householdId, table.createdBy],
      foreignColumns: [householdMembers.householdId, householdMembers.userId],
    }),
    foreignKey({
      columns: [table.householdId, table.recurringId],
      foreignColumns: [recurringExpenses.householdId, recurringExpenses.id],
    }),
    unique('expenses_recurring_month_unique').on(
      table.householdId,
      table.recurringId,
      table.month,
    ),
  ],
);

export const recurringExpenses = pgTable(
  'recurring_expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    dayOfMonth: integer('day_of_month').notNull(),
    startMonth: date('start_month').notNull(),
    categoryId: uuid('category_id').notNull(),
    active: boolean('active').notNull().default(true),
    createdBy: text('created_by').notNull(),
    creationKey: uuid('creation_key').notNull(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    unique('recurring_household_id_unique').on(table.householdId, table.id),
    unique('recurring_creation_unique').on(
      table.householdId,
      table.creationKey,
    ),
    index('recurring_household_active_idx').on(table.householdId, table.active),
    check(
      'recurring_amount_range',
      sql`${table.amountCents} between 1 and 9007199254740991`,
    ),
    check('recurring_day_range', sql`${table.dayOfMonth} between 1 and 31`),
    check(
      'recurring_first_day',
      sql`extract(day from ${table.startMonth}) = 1`,
    ),
    check('recurring_version_positive', sql`${table.version} > 0`),
    foreignKey({
      columns: [table.householdId, table.categoryId],
      foreignColumns: [categories.householdId, categories.id],
    }),
    foreignKey({
      columns: [table.householdId, table.createdBy],
      foreignColumns: [householdMembers.householdId, householdMembers.userId],
    }),
  ],
);

// Conserva a ocorrência mesmo se o usuário excluir a despesa gerada.
export const recurringOccurrences = pgTable(
  'recurring_occurrences',
  {
    householdId: uuid('household_id').notNull(),
    recurringId: uuid('recurring_id').notNull(),
    month: date('month').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.householdId, table.recurringId, table.month],
    }),
    foreignKey({
      columns: [table.householdId, table.recurringId],
      foreignColumns: [recurringExpenses.householdId, recurringExpenses.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.householdId, table.month],
      foreignColumns: [financialMonths.householdId, financialMonths.month],
    }).onDelete('cascade'),
  ],
);

export const settlements = pgTable(
  'settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id').notNull(),
    month: date('month').notNull(),
    fromUserId: text('from_user_id').notNull(),
    toUserId: text('to_user_id').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    status: settlementStatus('status').notNull().default('pending'),
    creationKey: uuid('creation_key').notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    confirmedAt: time('confirmed_at'),
  },
  (table) => [
    index('settlements_household_month_idx').on(table.householdId, table.month),
    unique('settlements_creation_unique').on(
      table.householdId,
      table.creationKey,
    ),
    uniqueIndex('settlements_one_pending_month')
      .on(table.householdId, table.month)
      .where(sql`${table.status} = 'pending'`),
    check(
      'settlements_amount_range',
      sql`${table.amountCents} between 1 and 9007199254740991`,
    ),
    check(
      'settlements_distinct_members',
      sql`${table.fromUserId} <> ${table.toUserId}`,
    ),
    check(
      'settlements_confirmation_consistent',
      sql`(${table.status} = 'confirmed') = (${table.confirmedAt} is not null)`,
    ),
    foreignKey({
      columns: [table.householdId, table.month],
      foreignColumns: [financialMonths.householdId, financialMonths.month],
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.householdId, table.fromUserId],
      foreignColumns: [householdMembers.householdId, householdMembers.userId],
    }),
    foreignKey({
      columns: [table.householdId, table.toUserId],
      foreignColumns: [householdMembers.householdId, householdMembers.userId],
    }),
  ],
);
