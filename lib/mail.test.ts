import { afterEach, expect, it, vi } from 'vitest';
import { isValidSender, sendAccessEmail } from './mail';

afterEach(() => vi.restoreAllMocks());
const data = {
  email: 'destinatario@example.test',
  url: 'https://app.example.test/acesso?token=segredo-de-teste',
};

it('exige e-mail, com ou sem nome, e rejeita quebras de linha', () => {
  for (const valid of [
    'acesso@example.test',
    'Contas a Dois <acesso@example.test>',
  ])
    expect(isValidSender(valid)).toBe(true);
  for (const invalid of [
    '',
    'Contas a Dois',
    'example.test',
    'Contas <invalido>',
    'acesso@example.test\r\nBcc: outro@example.test',
  ])
    expect(isValidSender(invalid)).toBe(false);
});

it('não chama o provedor quando o remetente está incompleto', async () => {
  const send = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(sendAccessEmail(send, 'Somente nome', data)).rejects.toThrow(
    'Não foi possível enviar',
  );
  expect(send).not.toHaveBeenCalled();
});

it('registra a categoria da falha sem expor o destinatário, a mensagem ou o token', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const send = vi.fn().mockResolvedValue({
    error: {
      name: 'validation_error',
      statusCode: 403,
      message: `You can only send testing emails to your own email address (${data.email}). ${data.url}`,
    },
  });
  await expect(
    sendAccessEmail(send, 'acesso@example.test', data),
  ).rejects.toThrow('Não foi possível enviar');
  expect(log).toHaveBeenCalledWith('Falha no envio de acesso pelo Resend.', {
    motivo: 'destinatario_restrito_ao_modo_teste',
    status: 403,
  });
  expect(JSON.stringify(log.mock.calls)).not.toContain(data.email);
  expect(JSON.stringify(log.mock.calls)).not.toContain('segredo-de-teste');
});

it('entrega o link ao provedor sem registrar o conteúdo em logs', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const send = vi.fn().mockResolvedValue({ error: null });
  await sendAccessEmail(send, 'acesso@example.test', data);
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: data.email,
      text: expect.stringContaining(data.url),
    }),
  );
  expect(log).not.toHaveBeenCalled();
});

it('não expõe detalhes de uma exceção de transporte', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const send = vi.fn().mockRejectedValue(new Error(data.url));
  await expect(
    sendAccessEmail(send, 'acesso@example.test', data),
  ).rejects.toThrow('Não foi possível enviar');
  expect(log).toHaveBeenCalledWith('Falha no envio de acesso pelo Resend.', {
    motivo: 'conexao_com_provedor_falhou',
  });
});
