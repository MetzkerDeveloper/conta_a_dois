# Documentação técnica — MVP 0.1

Aplicativo responsivo em pt-BR para um casal registrar rendas líquidas e despesas, dividir custos por regra configurável e acompanhar o repasse mensal consolidado.

- [Regras de negócio](business-rules.md)
- [Arquitetura e dados](architecture.md)
- [Interface e entregas](roadmap.md)
- [Configuração de banco, autenticação e testes](setup.md)
- [Como usar o espaço real](uso.md)

Stack alvo: Next.js App Router + TypeScript, Tailwind + shadcn/ui, Neon Postgres, Drizzle, Zod, React Hook Form, Resend, Vitest e Playwright. Monólito com Server Components para leitura e Server Actions para mutações.

Decisões implementadas nesta etapa: Better Auth, acesso por link mágico sem senha e modo proporcional disponível no combinado inicial. Google continua opcional e ainda não foi integrado. Nome e identidade finais permanecem em aberto.
