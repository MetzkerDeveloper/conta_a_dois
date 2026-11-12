import 'server-only';
import { Resend } from 'resend';
import { getDb } from '@/db';
import { createAuth } from './auth-factory';
import { sendAccessEmail, sendAccountEmail } from './mail';

export function isAuthConfigured(): boolean {
  return [
    'DATABASE_URL',
    'AUTH_SECRET',
    'AUTH_URL',
    'RESEND_API_KEY',
    'RESEND_FROM',
  ].every((key) => !!process.env[key]);
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (instance) return instance;
  if (!isAuthConfigured()) throw new Error('Autenticação não configurada.');
  const baseURL = process.env.AUTH_URL!;
  if (process.env.AUTH_SECRET!.length < 32)
    throw new Error('AUTH_SECRET precisa ter pelo menos 32 caracteres.');
  if (process.env.NODE_ENV === 'production' && !baseURL.startsWith('https://'))
    throw new Error('AUTH_URL precisa usar HTTPS em produção.');
  const resend = new Resend(process.env.RESEND_API_KEY!);
  instance = createAuth({
    db: getDb(),
    secret: process.env.AUTH_SECRET!,
    baseURL,
    sendAccountEmail: (data) =>
      sendAccountEmail(
        (payload) => resend.emails.send(payload),
        process.env.RESEND_FROM!,
        data,
      ),
    sendMagicLink: (data) =>
      sendAccessEmail(
        (payload) => resend.emails.send(payload),
        process.env.RESEND_FROM!,
        data,
      ),
  });
  return instance;
}
