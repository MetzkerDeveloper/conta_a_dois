const reasons: Record<string, string> = {
  '28P01': 'credenciais_do_banco_invalidas',
  '28000': 'acesso_ao_banco_recusado',
  '42P01': 'tabela_de_autenticacao_ausente',
  '42703': 'estrutura_de_autenticacao_desatualizada',
  ECONNRESET: 'conexao_com_banco_interrompida',
  ECONNREFUSED: 'conexao_com_banco_recusada',
  ETIMEDOUT: 'tempo_de_conexao_excedido',
  EAI_AGAIN: 'resolucao_de_rede_indisponivel',
  ENOTFOUND: 'servidor_do_banco_nao_encontrado',
  '57P03': 'banco_temporariamente_indisponivel',
};

/** Só retorna categorias conhecidas; mensagens, SQL e parâmetros não são logs. */
export function sessionFailureReason(error: unknown): string {
  const visited = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    if (
      'code' in current &&
      typeof current.code === 'string' &&
      Object.hasOwn(reasons, current.code)
    )
      return reasons[current.code]!;
    current = 'cause' in current ? current.cause : undefined;
  }
  return 'falha_na_verificacao_de_acesso';
}

export class SessionVerificationError extends Error {
  constructor() {
    // Não anexar o erro original como cause: ele pode carregar SQL e tokens.
    super(
      'Não foi possível verificar seu acesso. Tente novamente em instantes.',
    );
    this.name = 'SessionVerificationError';
  }
}

export async function verifySession<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error('Falha na verificação de acesso.', {
      motivo: sessionFailureReason(error),
    });
    throw new SessionVerificationError();
  }
}

export function authLogger(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  ...details: unknown[]
) {
  if (level === 'error') {
    const reason = [message, ...details]
      .map(sessionFailureReason)
      .find((item) => item !== 'falha_na_verificacao_de_acesso');
    console.error('Falha no serviço de autenticação.', {
      motivo: reason ?? 'falha_interna_de_autenticacao',
    });
  } else if (level === 'warn') {
    console.warn('Aviso do serviço de autenticação.', {
      motivo: message.startsWith(
        'Rate limiting could not determine a client IP',
      )
        ? 'ip_do_cliente_nao_identificado'
        : 'aviso_de_autenticacao',
    });
  }
}
