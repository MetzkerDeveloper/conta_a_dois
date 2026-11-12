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
  html: string;
}) => Promise<{ error: DeliveryError | null }>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character]!;
  });
}

function accessEmailHtml(
  url: string,
  content = {
    preheader:
      'Seu link seguro para entrar no Contas a Dois. Ele expira em 10 minutos.',
    eyebrow: 'Acesso à sua conta',
    title: 'Seu espaço está a um clique.',
    description: 'Use o botão abaixo para entrar com segurança.',
    button: 'Entrar no Contas a Dois',
  },
): string {
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background-color:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#202c2c;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(content.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f6f4;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:separate;border-spacing:0;">
          <tr><td style="padding:22px 28px;background-color:#286351;border-radius:14px 14px 0 0;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.4px;">contas a dois</p>
            <p style="margin:5px 0 0;color:#dcebe3;font-size:12px;">Um combinado claro para a vida financeira de vocês.</p>
          </td></tr>
          <tr><td style="padding:34px 28px 30px;background-color:#ffffff;border:1px solid #e1e9e4;border-top:0;">
            <p style="margin:0 0 12px;color:#286351;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(content.eyebrow)}</p>
            <h1 style="margin:0 0 14px;color:#202c2c;font-size:26px;line-height:1.25;letter-spacing:-0.6px;">${escapeHtml(content.title)}</h1>
            <p style="margin:0 0 24px;color:#50615a;font-size:15px;line-height:1.65;">${escapeHtml(content.description)}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
              <tr><td align="center" style="border-radius:8px;background-color:#286351;">
                <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border:1px solid #286351;border-radius:8px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(content.button)}</a>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;color:#657274;font-size:12px;line-height:1.6;">O link expira em <strong style="color:#202c2c;">10 minutos</strong> e só pode ser usado uma vez.</p>
            <p style="margin:0;color:#657274;font-size:12px;line-height:1.6;">Se o botão não abrir, copie este endereço para o navegador:</p>
            <p style="margin:8px 0 0;overflow-wrap:anywhere;font-size:12px;line-height:1.6;"><a href="${safeUrl}" style="color:#286351;">${safeUrl}</a></p>
          </td></tr>
          <tr><td style="padding:18px 12px;text-align:center;">
            <p style="margin:0;color:#657274;font-size:12px;line-height:1.6;">Se você não pediu este acesso, pode ignorar esta mensagem.</p>
            <p style="margin:8px 0 0;color:#87938e;font-size:11px;">Contas a Dois · Organização financeira em conjunto</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

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
    const text = `Seu acesso ao Contas a Dois\n\nEntre pelo link abaixo:\n${url}\n\nO link expira em 10 minutos e só pode ser usado uma vez. Se você não pediu este acesso, ignore esta mensagem.`;
    response = await send({
      from,
      to: email,
      subject: 'Seu acesso ao Contas a Dois',
      text,
      html: accessEmailHtml(url),
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

export async function sendAccountEmail(
  send: SendEmail,
  from: string,
  {
    email,
    url,
    purpose,
  }: { email: string; url: string; purpose: 'password' | 'verification' },
): Promise<void> {
  if (!isValidSender(from)) throw new Error('Remetente inválido.');
  const title =
    purpose === 'password' ? 'Cadastre sua senha' : 'Confirme seu e-mail';
  const text = `${title} no Contas a Dois. O link vale por 10 minutos e só pode ser usado uma vez. Se não solicitou, ignore esta mensagem.`;
  try {
    const result = await send({
      from,
      to: email,
      subject: `${title} · Contas a Dois`,
      text: `${text}\n\n${url}`,
      html: accessEmailHtml(url, {
        preheader: `${title} com segurança. Seu link expira em 10 minutos.`,
        eyebrow:
          purpose === 'password'
            ? 'Segurança da sua conta'
            : 'Boas-vindas ao Contas a Dois',
        title,
        description:
          purpose === 'password'
            ? 'Use o botão abaixo para cadastrar ou redefinir sua senha. Depois, você poderá entrar com seu e-mail e senha.'
            : 'Confirme seu e-mail para começar a organizar as contas a dois. Depois, entre com a senha que você cadastrou.',
        button:
          purpose === 'password'
            ? 'Cadastrar minha senha'
            : 'Confirmar meu e-mail',
      }),
    });
    if (result.error) throw new Error('Falha na entrega.');
  } catch {
    throw new Error('Não foi possível enviar o e-mail.');
  }
}
