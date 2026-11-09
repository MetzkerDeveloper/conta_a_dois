# Contas a Dois

Gestão financeira para casais. Fundação em Next.js App Router, React, TypeScript, Tailwind e Lucide, com motor de divisão mensal puro e testes.

Requer Node.js 22 ou superior.

```sh
npm ci
npm run dev
```

Abra http://localhost:3000. A página inicial é uma demonstração com dados fictícios de novembro de 2026, mantidos somente na memória da aba. Recarregar restaura o exemplo.

O fluxo real fica em `/login` → `/comecar` → `/casal`. Ele usa Better Auth com link mágico, Postgres/Drizzle e Resend. O painel autenticado salva rendas, despesas, categorias e regras por competência no banco. Inclui criação, edição e exclusão de despesas, filtros, seleção de mês e cálculo do repasse. Veja [como usar o espaço real](docs/uso.md).

Para ativar o acesso, copie `.env.example` para `.env.local`, preencha as credenciais e aplique as migrations conforme o [guia de configuração](docs/setup.md). Sem credenciais, a demonstração continua disponível e o login informa que o acesso ainda não foi ativado.

```sh
npm run lint
npm run typecheck
npm test
# Com TEST_DATABASE_URL de um Postgres isolado:
npm run test:integration
npm run build
npm start
```

Testes de navegador (executar depois do build):

```sh
npx playwright install chromium
npm run test:e2e
```

Se já houver Chrome instalado, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/caminho/do/chrome npm run test:e2e`. Os testes cobrem demonstração e proteção das rotas em desktop e em 360 px. O build usa Webpack para funcionar também em ambientes que restringem as portas internas do Turbopack.

O fluxo autenticado tem uma suíte separada, que exige `TEST_DATABASE_URL` e inicia um servidor de desenvolvimento na porta 3101:

```sh
npm run test:e2e:account
```

Ela cria sessões reais pelo Better Auth, captura os e-mails em memória e usa duas sessões de navegador para criar o casal, aceitar o convite, confirmar rendas, cadastrar/editar/excluir uma despesa, conferir o repasse e alterar a regra sem recalcular o mês iniciado. Não há rota de bypass de login nem envio externo de e-mail durante os testes.

As rotas `/`, `/despesas`, `/rendas`, `/repasses` e `/ajustes` continuam sendo a demonstração fictícia. Os dados reais ficam exclusivamente em `/casal` e suas subrotas. Em `/casal/repasses`, o remetente registra o envio e o destinatário confirma; somente os confirmados são descontados do saldo.

Consulte [a documentação](docs/README.md) para escopo, regras e próximos passos. Recorrências, fechamento/reabertura e ferramentas de privacidade estão disponíveis. Antes da abertura pública, complete os dados legais do controlador, confirme a retenção dos provedores e teste a restauração de backup.

O GitHub Actions executa lint, typecheck, testes unitários, integração em Postgres 17, build e as duas suítes de navegador. A publicação pode ser feita importando o repositório na Vercel com o preset Next.js. O banco usa Neon; aplique as migrations pendentes com `npm run db:migrate` antes de usar uma nova versão.
