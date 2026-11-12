# Banco, acesso e testes

As etapas de casal e lançamentos financeiros estão implementadas. Os testes usam Postgres 17 local e e-mails capturados em memória. O ambiente real usa as credenciais Neon/Resend do arquivo local; não as copie para os testes automatizados.

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. No Neon, crie/selecione um branch de desenvolvimento. Configure `DATABASE_URL` com a conexão pooled e `DATABASE_URL_UNPOOLED` com a conexão direta do mesmo branch. Preserve as opções TLS fornecidas pela Neon.
3. Gere `AUTH_SECRET` com `openssl rand -base64 48` e salve o resultado somente no arquivo de ambiente. O valor precisa ter pelo menos 32 caracteres. Não compartilhe o segredo em conversas ou commits.
4. Configure `AUTH_URL=http://localhost:3000`. Em produção, use a origem HTTPS exata. O código não habilita autenticação em produção com uma origem HTTP.
5. Configure `RESEND_API_KEY` e `RESEND_FROM` com um remetente autorizado no Resend. O link de acesso é enviado somente após uma solicitação do usuário. E-mails de convite não são enviados: a pessoa copia e compartilha o link.
6. Execute `npm run db:migrate` e depois `npm run dev`. Reinicie o servidor após alterar as variáveis.

O código usa a [integração Drizzle/Postgres compatível com Neon](https://orm.drizzle.team/docs/connect-neon) e o [login com e-mail e senha do Better Auth](https://better-auth.com/docs/authentication/email-password). Sessões duram sete dias; links de verificação e de cadastro/recuperação de senha, dez minutos e uso único. Os cookies usam httpOnly e sameSite=lax, com secure quando a origem é HTTPS. Senhas usam o hash do Better Auth. Tokens de convite são armazenados como hash. Links mágicos antigos continuam compatíveis durante a transição.

Aplique as migrations com `npm run db:migrate` antes de publicar esta versão. A migration `0006` cria as rendas fixas a partir da última renda conhecida de cada pessoa e adiciona o campo de extras mensais. A migration `0007` separa os extras em itens e preserva os valores anteriores como um item de renda extra. A configuração de Resend existente também entrega verificação de e-mail e cadastro/recuperação de senha.

Use `sslmode=verify-full` nas conexões Neon para explicitar a verificação completa do certificado e evitar o aviso de mudança de semântica do driver pg. Não desabilite a verificação do certificado para eliminar o aviso.

`RESEND_FROM` precisa conter um endereço completo, como `Contas a Dois <acesso@mail.example.com>`. O endereço deve usar o domínio exato verificado no Resend: verificar `mail.example.com` não autoriza automaticamente um remetente `@example.com`. A caixa de recebimento da sua hospedagem pode usar outro domínio; ela não substitui a verificação do domínio de envio. Veja a [orientação sobre domínio do remetente](https://resend.com/docs/knowledge-base/403-error-domain-mismatch).

Em falhas de envio, o servidor registra somente a categoria e o status do erro. Categorias distinguem remetente inválido, domínio não verificado, restrição de destinatário de teste, chave inválida e limite de envios. Mensagens originais do provedor, destinatários, credenciais e links de acesso não são registrados. Reinicie o servidor depois de alterar o remetente ou a chave, pois o cliente de autenticação é reutilizado durante a execução.

## Fluxo disponível

1. Entre em `/login`, informe nome e e-mail e abra o link recebido.
2. Em `/comecar`, aceite a política, escolha nome, modo, percentual inicial e dia de repasse e crie o casal.
3. Em `/casal`, gere um convite e compartilhe o link de forma privada. Gerar outro link revoga o anterior. Validade: sete dias.
4. A outra pessoa abre o link, autentica seu próprio e-mail, aceita a política e confirma a entrada.
5. Cada membro vê o mesmo casal e os dois nomes de exibição. As consultas não expõem e-mails ou sessões do parceiro.

Uma pessoa pode integrar apenas um casal. Há uma vaga inicial e uma vaga de parceiro, protegidas por transações e constraints. Ainda não há saída/troca de casal ou exclusão de conta na interface. As rendas e despesas reais ficam em `/casal/rendas` e `/casal/despesas`, e as regras em `/casal/ajustes`. Veja o [guia de uso](uso.md).

## Migrations

```sh
npm run db:generate
npm run db:migrate
```

`db:generate` gera SQL e snapshots versionados sem acessar o banco. `db:migrate` exige `DATABASE_URL_UNPOOLED`, aplica apenas migrations pendentes e fecha a conexão. Não é executado automaticamente no build. Revise o SQL e selecione o ambiente antes de executar. Não use `drizzle-kit push` como substituto de migrations em produção.

## Testes isolados

Os testes de integração e de navegador autenticado exigem `TEST_DATABASE_URL` com nome do banco terminado em `_test`. Eles aplicam as migrations reais, inserem dados fictícios e limpam os contadores de autenticação desse banco. Nunca use um banco que contenha dados reais.

Exemplo de Postgres temporário, limitado ao loopback local:

```sh
docker run --detach --rm --name contas-a-dois-tests \
  --env POSTGRES_PASSWORD=local-tests-only \
  --env POSTGRES_DB=contas_a_dois_test \
  --publish 127.0.0.1:55432:5432 postgres:17-alpine
```

Configure `TEST_DATABASE_URL=postgresql://postgres:local-tests-only@127.0.0.1:55432/contas_a_dois_test` em `.env.test.local` ou no ambiente do terminal. Os testes de integração e de casal carregam somente esse arquivo de teste; não carregam `.env.local`. Essa senha é exclusiva do contêiner fictício local.

```sh
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e:account
npm run build
npm run test:e2e
docker stop contas-a-dois-tests
```

O teste de casal usa a porta 3101 e um banco de teste. Gera sessões pelo handler real do Better Auth, captura os e-mails em memória e abre sessões separadas de navegador para o casal; nenhum e-mail é enviado ao Resend. Não existe endpoint de bypass no app. O teste geral usa o build na porta 3100 com as credenciais de autenticação desabilitadas explicitamente no servidor de teste. Para usar o Chrome já instalado, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Limites e publicação

Login: três solicitações de link por minuto e limite geral de 60 requisições de autenticação por minuto, armazenados no banco. Na Vercel, a identificação usa o cabeçalho de IP da plataforma; fora dela, os pedidos compartilham o contador de cada rota. Configure explicitamente o proxy confiável antes de usar outra hospedagem. Geração de convite: dez por usuário/hora; aceite: trinta tentativas por usuário/hora; criação de casal: cinco tentativas por usuário/hora. Os limites das actions são atômicos no banco.

Na Vercel, use runtime Node.js e configure todas as variáveis por ambiente. `AUTH_URL` deve corresponder à origem que o usuário acessa; prévias com outros domínios precisam de configuração própria e banco separado. Migre o branch correto antes de ativar as rotas persistentes. Nunca configure segredos de produção em previews não confiáveis.

O app já oferece exportação JSON e exclusão da conta/espaço em Ajustes; a página `/privacidade` descreve o escopo. Antes da abertura pública, o responsável pelo produto deve completar seus dados legais na política, confirmar os prazos de retenção dos provedores e testar a restauração do banco.
