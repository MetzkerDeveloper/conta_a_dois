import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { magicLink } from 'better-auth/plugins';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { Database } from '@/db';
import * as schema from '@/db/schema';
import { authLogger } from './security/session-errors';
import { loginSchema } from '@/features/auth/schema';

type AuthConfig = {
  db: Database;
  secret: string;
  baseURL: string;
  allowMagicLinkRequests?: boolean;
  sendAccountEmail?: (data: {
    email: string;
    url: string;
    purpose: 'password' | 'verification';
  }) => Promise<void>;
  sendMagicLink: (data: { email: string; url: string }) => Promise<void>;
};

// A fábrica permite testar o fluxo real sem enviar e-mails externos.
export function createAuth(config: AuthConfig) {
  return betterAuth({
    appName: 'Contas a Dois',
    logger: { log: authLogger },
    baseURL: config.baseURL,
    secret: config.secret,
    database: drizzleAdapter(config.db, {
      provider: 'pg',
      schema,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        if (!config.sendAccountEmail)
          throw new Error('Entrega de e-mail não configurada.');
        await config.sendAccountEmail({
          email: user.email,
          url,
          purpose: 'password',
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      expiresIn: 600,
      sendVerificationEmail: async ({ user, url }) => {
        if (!config.sendAccountEmail)
          throw new Error('Entrega de e-mail não configurada.');
        await config.sendAccountEmail({
          email: user.email,
          url,
          purpose: 'verification',
        });
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email') {
          const parsed = loginSchema.safeParse(ctx.body);
          if (!parsed.success)
            throw new APIError('BAD_REQUEST', {
              message: 'Informe nome e e-mail válidos.',
            });
          ctx.body.name = parsed.data.name;
          ctx.body.email = parsed.data.email;
        }
        if (ctx.path !== '/sign-in/magic-link') return;
        if (!config.allowMagicLinkRequests)
          throw new APIError('FORBIDDEN', {
            message: 'Entre com e-mail e senha.',
          });
        if (ctx.headers?.get('origin') !== new URL(config.baseURL).origin) {
          throw new APIError('FORBIDDEN', {
            message: 'Origem de acesso inválida.',
          });
        }
        const parsed = loginSchema.safeParse(ctx.body);
        if (!parsed.success)
          throw new APIError('BAD_REQUEST', {
            message: 'Informe nome e e-mail válidos.',
          });
        ctx.body.name = parsed.data.name;
        ctx.body.email = parsed.data.email;
      }),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 60 },
    advanced: {
      useSecureCookies: config.baseURL.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
      ipAddress: {
        ipAddressHeaders: process.env.VERCEL ? ['x-vercel-forwarded-for'] : [],
      },
    },
    plugins: [
      magicLink({
        expiresIn: 60 * 10,
        storeToken: 'hashed',
        rateLimit: { window: 60, max: 3 },
        sendMagicLink: config.sendMagicLink,
      }),
    ],
  });
}
