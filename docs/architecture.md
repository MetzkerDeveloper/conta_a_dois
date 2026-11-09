# Arquitetura e dados

Navegador → Next.js na Vercel → Neon Postgres; Resend para convites e links de login. Sem backend separado, filas ou microserviços.

Pastas planejadas: app para rotas e UI; features/<domínio> para actions, queries, schemas e componentes; lib/settlement para motor puro; db para schema, cliente e migrações.

Entidades previstas:

| Entidade           | Dados e restrições principais                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| users              | Identidade gerenciada pela biblioteca de autenticação                                                                       |
| households         | Nome, modo, percentual, desempate, pagador responsável, dia de repasse 1–31                                                 |
| household_members  | household_id, user_id, display_name; par único; limite 2 sob transação                                                      |
| invites            | household_id, token_hash, expires_at, accepted_at; uso único, validade 7 dias                                               |
| incomes            | household_id, user_id, mês no dia 1, amount_cents; membro/mês único                                                         |
| categories         | household_id, nome, cor                                                                                                     |
| recurring_expenses | household_id, descrição, valor, dia, categoria, pagador padrão, ativo                                                       |
| expenses           | household_id, descrição, valor, vencimento, competência, categoria, pagador opcional, paid_at, criador, recurring_id, notas |
| month_closings     | household_id + mês únicos, snapshot JSONB, closed_at                                                                        |
| settlements        | household_id, mês, origem, destino, valor, status pending/confirmed, datas                                                  |

A regra por competência é guardada em financial_months no primeiro lançamento de renda ou despesa. Ocorrências recorrentes têm unicidade por modelo/competência e ledger permanente para geração idempotente. Índices de despesas e rendas por household_id/mês; checks de valores, FKs compostas e integridade de referências ao mesmo casal. Rendas admitem zero; despesas exigem valor positivo. Dias inexistentes no mês usam o último dia válido.

Segurança: requireHousehold() no servidor em toda operação; Zod nas mutações; tokens aleatórios armazenados como hash; cookies httpOnly/secure/sameSite=lax; limite de tentativas em login/convite; erros sem detalhes internos. Consentimento, política de privacidade, exportação e exclusão de dados com tratamento explícito do histórico compartilhado.

Operação futura: DATABASE_URL pooled, DATABASE_URL_UNPOOLED para migrações, AUTH_SECRET, AUTH_URL, RESEND_API_KEY e credenciais Google opcionais. Migrações versionadas e aplicadas de forma controlada. Cron diário autenticado para recorrências. Testar restauração Neon antes do lançamento. Não executar migração destrutiva sem backup.

Na fundação, TypeScript está na série 5.9 compatível com o lint. O override de minimatch no eslint-config-next usa a versão corrigida 11 para eliminar o alerta GHSA-g3hv-75wg-m249 na ferramenta de desenvolvimento. O override de esbuild no loader legado usado pelo drizzle-kit elimina GHSA-67mh-4wv8-2f99; a geração de migrations foi verificada com ele. Revisar os overrides ao atualizar essas ferramentas. O build usa Webpack, pois o ambiente local restringe portas internas usadas pelo Turbopack.

Implementado: tabelas de autenticação, households, household_members, invites, limites de tentativas, categories, financial_months, incomes e expenses. Recorrências, snapshots de fechamento e repasses continuam planejados. O cliente usa drizzle-orm/node-postgres e pg, compatíveis com Neon em runtime Node.js e com o Postgres local. Conexões pooled para a aplicação; direta para migrations. Configuração lazy evita acesso ao banco durante o build.

A associação permite uma pessoa em apenas um casal neste MVP. A primeira pessoa ocupa slot 1 e a segunda slot 2; checks e índices únicos impedem um terceiro membro no banco. Criação e aceite bloqueiam o usuário; geração/rotação/aceite de convite também bloqueiam o casal, sempre nessa ordem. Novos links revogam os anteriores. O token original só é retornado uma vez; o banco guarda SHA-256, validade de sete dias e quem aceitou.

Toda action obtém o usuário de uma sessão verificada. requireHousehold() deriva o casal dessa identidade, sem receber household_id do cliente. Exceções de bootstrap: consultas da associação por userId da sessão e do convite pelo token de alta entropia, após login. Não há cache de cookie de sessão; a validade é conferida no servidor. O login exige origem igual a AUTH_URL, além das proteções da biblioteca.

As operações financeiras ficam em features/finance. Cada mutação consulta a associação do usuário autenticado, bloqueia a linha do casal e valida todas as referências no mesmo household_id. A renda só pode ser alterada por seu titular; ambos podem manter as despesas. Valores em bigint no banco e inteiros seguros no motor; a soma do mês é validada antes da gravação. As leituras usam uma transação repeatable read para não combinar cotas e pagamentos de estados diferentes.

Uma chave por formulário impede duplicação de despesa em reenvios. Versões de renda e despesa rejeitam sobrescritas ou exclusões com dados antigos. A regra do mês não muda quando o padrão do casal é atualizado. closed_at já bloqueia mutações, mas o comando de fechamento/reabertura e o snapshot completo ainda não foram implementados. As categorias são criadas na mesma transação do novo casal; a migration 0001 preenche as categorias dos casais existentes sem alterar usuários ou associações.
