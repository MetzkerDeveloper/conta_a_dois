import { afterEach, expect, it, vi } from 'vitest';
import {
  authLogger,
  sessionFailureReason,
  SessionVerificationError,
  verifySession,
} from './session-errors';

afterEach(() => vi.restoreAllMocks());
it('preserva sessões válidas e ausência de sessão sem alterar a autorização', async () => {
  const session = { user: { id: 'pessoa' } };
  expect(await verifySession(async () => session)).toBe(session);
  expect(await verifySession(async () => null)).toBeNull();
});
it('identifica a senha inválida na causa sem expor SQL ou token', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = new Error(
    'Failed query: select token from sessions; params: SEGREDO_DE_TESTE',
    {
      cause: Object.assign(new Error('password authentication failed'), {
        code: '28P01',
      }),
    },
  );
  expect(sessionFailureReason(error)).toBe('credenciais_do_banco_invalidas');
  let failure: unknown;
  try {
    await verifySession(async () => {
      throw error;
    });
  } catch (caught) {
    failure = caught;
  }
  expect(failure).toBeInstanceOf(SessionVerificationError);
  expect((failure as Error).cause).toBeUndefined();
  expect(String(failure)).not.toContain('SEGREDO_DE_TESTE');
  expect(log).toHaveBeenCalledWith('Falha na verificação de acesso.', {
    motivo: 'credenciais_do_banco_invalidas',
  });
  expect(JSON.stringify(log.mock.calls)).not.toContain('SEGREDO_DE_TESTE');
});
it('o logger da biblioteca não registra detalhes privados em nenhum nível', () => {
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warnLog = vi.spyOn(console, 'warn').mockImplementation(() => {});
  authLogger(
    'error',
    'SQL COM SEGREDO_DE_TESTE',
    new Error('SEGREDO_DE_TESTE'),
  );
  authLogger('warn', 'SEGREDO_DE_TESTE', { token: 'SEGREDO_DE_TESTE' });
  authLogger('info', 'SEGREDO_DE_TESTE');
  expect(
    JSON.stringify([errorLog.mock.calls, warnLog.mock.calls]),
  ).not.toContain('SEGREDO_DE_TESTE');
});
it('não reutiliza códigos arbitrários como texto de log nem entra em ciclo nas causas', () => {
  const error: { code: string; cause?: unknown } = { code: 'SEGREDO_DE_TESTE' };
  error.cause = error;
  expect(sessionFailureReason(error)).toBe('falha_na_verificacao_de_acesso');
  expect(sessionFailureReason({ cause: { code: 'ETIMEDOUT' } })).toBe(
    'tempo_de_conexao_excedido',
  );
});
