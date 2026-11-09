import { z } from 'zod';

type DeliveryError = {
  name: string;
  message: string;
  statusCode?: number | null;
};
type SendEmail = (message: {
  from: string;
  to: string;
  subject: string;
  text: string;
}) => Promise<{ error: DeliveryError | null }>;

export function isValidSender(from: string): boolean {
  const value = from.trim();
  const named = value.match(/^[^<>\r\n]+<([^<>\r\n]+)>$/);
  return (
    !/[\r\n]/.test(from) &&
    z.email().safeParse(named ? named[1].trim() : value).success
  );
}

function classify(error: DeliveryError): string {
  const message = error.message.toLowerCase();
  if (message.includes('only send testing emails'))
    return 'destinatario_restrito_ao_modo_teste';
  if (message.includes('domain') && message.includes('not verified'))
    return 'dominio_do_remetente_nao_verificado';
  if (error.statusCode === 401 || error.name === 'missing_api_key')
    return 'chave_invalida_ou_ausente';
  if (message.includes('from') || message.includes('sender'))
    return 'remetente_invalido_ou_nao_autorizado';
  if (error.statusCode === 429) return 'limite_de_envios';
  if (error.statusCode === 403) return 'envio_nao_autorizado';
  return 'falha_no_provedor';
}

export async function sendAccessEmail(
  send: SendEmail,
  from: string,
  { email, url }: { email: string; url: string },
): Promise<void> {
  if (!isValidSender(from)) {
    console.error('Falha no envio de acesso pelo Resend.', {
      motivo: 'RESEND_FROM_sem_email_valido',
    });
    throw new Error('Não foi possível enviar o e-mail de acesso.');
  }
  let response;
  try {
    response = await send({
      from,
      to: email,
      subject: 'Seu acesso ao Contas a Dois',
      text: `Use este link para entrar no Contas a Dois:\n\n${url}\n\nEle expira em 10 minutos e só pode ser usado uma vez. Se você não pediu o acesso, ignore esta mensagem.`,
    });
  } catch {
    console.error('Falha no envio de acesso pelo Resend.', {
      motivo: 'conexao_com_provedor_falhou',
    });
    throw new Error('Não foi possível enviar o e-mail de acesso.');
  }
  if (response.error) {
    // A mensagem original pode conter destinatário ou outros dados privados.
    // Registrar apenas categorias conhecidas e status; nunca payload, chave ou link.
    console.error('Falha no envio de acesso pelo Resend.', {
      motivo: classify(response.error),
      status: response.error.statusCode ?? null,
    });
    throw new Error('Não foi possível enviar o e-mail de acesso.');
  }
}
