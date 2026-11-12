# Contas a Dois

- Produto e arquitetura: docs/README.md. Stack alvo: Next.js App Router, TypeScript estrito, Tailwind, Drizzle, Neon, Vercel.
- Motor puro em lib/settlement; UI em app; ações, consultas e schemas Zod em features/<domínio>; banco em db.
- Dinheiro sempre em centavos inteiros seguros. Produtos e arredondamento do motor usam bigint. Nunca calcular dinheiro com ponto flutuante.
- Toda consulta e mutação de negócio deve obter household_id da sessão no servidor; nunca confiar no cliente para autorização.
- Casais têm exatamente dois membros para o cálculo; convites devem impedir um terceiro membro de forma transacional.
- Meses fechados são imutáveis; regras e números são snapshots por competência.
- Finanças reais em features/finance e /casal/{despesas,rendas,ajustes}. A primeira renda/despesa guarda a regra em financial_months; ajustes posteriores só afetam competências sem lançamentos.
- Mutação financeira, geração de recorrências e fechamento usam o mesmo lock de households. Renda é editável somente pelo titular; despesas, pelos dois membros. Renda fixa é reaproveitada automaticamente; extras e edições pontuais ficam na competência. Leituras projetam rendas sem escrever; mutações congelam valores sob o lock. Fechamento exige rendas cadastradas, contas pagas e repasses concluídos, guarda snapshot e verifica fingerprint contra dados desatualizados.
- recurring_occurrences conserva o controle de geração mesmo após excluir a despesa. Recorrências são geradas por Server Action ao abrir a competência, sempre pendentes de pagamento. Não escrever dados em leituras/prefetch de Server Components.
- Preservar chave de criação e versões dos registros para evitar duplicações e sobrescritas. Categorias/pagadores devem pertencer ao casal, inclusive por FKs compostas.
- Preservar testes do motor e dos utilitários monetários. Comandos: npm run dev; npm run lint; npm run typecheck; npm test; npm run build. Node.js >=22.
- A interface em features/demo é uma simulação efêmera separada do fluxo autenticado em /casal. Não usar seus IDs fixos como autorização em código de produção.
- Better Auth com e-mail e senha e Resend; contas legadas cadastram senha por e-mail; configuração lazy em lib/auth.ts. Não inicializar banco ou auth no build nem registrar tokens/links em logs. Somente hash de token em invites.
- Bootstrap de associação consulta pelo userId da sessão; consulta de convite usa token como autorização e exige login. Todas as consultas posteriores derivam household_id dessa associação no servidor.
- Testes de integração: npm run test:integration com TEST_DATABASE_URL de banco isolado cujo nome termine em _test. As migrations reais são aplicadas nesse banco. Não usar produção.
- Tokens visuais em app/globals.css; ícones Lucide; formulários com React Hook Form e Zod. Não adicionar fontes remotas obrigatórias ao build.
- Não versionar segredos. Textos de interface em pt-BR, foco visível e layout mobile-first.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
