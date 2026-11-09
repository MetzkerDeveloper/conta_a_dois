# Interface, validação e próximas entregas

1. Fundação: motor e utilitários com testes, Next.js App Router, Tailwind, shell responsivo, demonstração integrada ao motor, lint e workflow CI implementados. Deploy inicial Vercel pendente de conexão com a conta/repositório.
2. Casal: Better Auth com link mágico, criação, convite com expiração/revogação, registro de concordância com a política e isolamento entre casais implementados. Login real e criação do casal validados pelo usuário. Ajustes incluem desempate, pagador responsável, percentual e dia; competências já iniciadas preservam sua regra.
3. Lançamentos: rendas mensais por membro e CRUD de despesas persistentes implementados. Categorias iniciais por casal, observações, vencimento, pagador, filtros e proteção contra reenvio duplicado e edições concorrentes.
4. Painel: implementado em `/casal` com competência, cotas, pago, saldo, pendências e sugestão de repasse. Exige dois membros e rendas explícitas do mês; a renda anterior é somente uma sugestão.
5. Repasses: implementados registro pelo remetente, confirmação exclusiva pelo destinatário, valores parciais, cancelamento de pendentes e desconto somente dos confirmados. Um registro pendente por competência evita envios duplicados; o histórico fica em `/casal/repasses`.
6. Recorrências e fechamento: implementados geração idempotente ao abrir a competência, pausa/edição de modelos, fechamento com snapshot e reabertura.
7. Privacidade: exportação JSON do perfil e dos dados compartilhados do casal, exclusão transacional de conta e espaço financeiro com confirmação digitada e aviso sobre o impacto no outro membro. Categorias personalizadas permanecem como melhoria.

Telas: painel, despesas, rendas, repasses e ajustes. Mobile a 360px, navegação inferior com quatro destinos e ação de lançar despesa; desktop com sidebar. Tokens CSS próprios, um destaque, tema escuro, Lucide consistente e tipografia com números tabulares. Moeda alinhada à direita, estados vazio/carregando/erro/sucesso, labels e foco visível; contraste AA. Meta LCP <2,5s em 4G, a medir na aplicação.

CI configurado: lint → typecheck → testes unitários → integração em Postgres → build → testes de navegador. Playwright cobre a demonstração, proteção de rotas e criação/convite do casal com sessões separadas em desktop e 360 px. Integração cobre o handler real do Better Auth, isolamento entre casais, cookies seguros, limites persistidos, revogação/expiração/reutilização e concorrência no aceite de convites. Qualidade futura: despesas/repasses persistentes e concorrência no fechamento.

A demonstração usa novembro de 2026, IDs fictícios e estado em memória compartilhado entre as rotas. Permite adicionar/excluir despesas, filtrar categorias, editar rendas e testar regras. Ainda não representa CRUD persistente, histórico, envio/confirmação de repasses, configuração completa do casal ou autenticação. Na versão real, mover dados para queries/actions autorizadas, mantendo o motor puro. Alterações de regra em tempo real são exclusivas da demonstração.

O fluxo persistente usa `/login`, `/comecar`, `/casal`, `/casal/rendas`, `/casal/despesas`, `/casal/ajustes` e `/convite/[token]`. Política e ferramentas de exportação/exclusão estão disponíveis; antes da abertura pública, o responsável deve completar os dados legais do controlador e os prazos concretos de retenção dos provedores. Nenhum dado da demonstração é copiado para esse fluxo.

Aceite final: dois usuários no mesmo casal; regra refletida no painel da competência aplicável; contas sem diferença de centavos; envio e confirmação; isolamento comprovado; produção Vercel/Neon com CI verde e uso em celular.

Fora do MVP: parcelamento/cartões, orçamento/metas, Open Finance, anexos, notificações, offline, múltiplas moedas e mais de dois membros.
