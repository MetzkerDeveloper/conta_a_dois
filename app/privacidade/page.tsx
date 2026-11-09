import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="account-container privacy-page">
      <Link href="/" className="account-brand">
        contas a dois
      </Link>
      <article className="panel account-card">
        <p className="eyebrow">Versão de 9 de novembro de 2026</p>
        <h1>Privacidade, com clareza.</h1>
        <h2>O que guardamos</h2>
        <p>
          Nome, e-mail, sessão de acesso, nome do casal, membros, regra de
          divisão, categorias, rendas mensais, despesas, seus pagamentos e o
          registro da sua concordância com esta política. Também guardamos os
          registros de repasses entre membros e suas confirmações, modelos de
          despesas recorrentes e snapshots de fechamento mensal.
        </p>
        <h2>Para que usamos</h2>
        <p>
          Para autenticar seu acesso, reunir as duas pessoas no mesmo espaço e
          organizar a divisão financeira. Usamos dados de sessão e limites de
          tentativas para proteger o acesso. Não usamos seus dados para
          publicidade.
        </p>
        <h2>O que seu par vê</h2>
        <p>
          Quem entra no mesmo casal vê o nome de exibição, os combinados e as
          informações financeiras compartilhadas. Um link de convite dá acesso a
          esse espaço; compartilhe apenas com a pessoa escolhida.
        </p>
        <h2>Serviços envolvidos</h2>
        <p>
          A hospedagem prevista é na Vercel, o banco de dados na Neon e o envio
          de links de acesso pelo Resend. Esses serviços processam as
          informações necessárias para operar o aplicativo e podem usar
          infraestrutura fora do Brasil.
        </p>
        <h2>Controle dos seus dados</h2>
        <p>
          Em Ajustes, você pode baixar um arquivo JSON com seu perfil e os dados
          compartilhados do casal, ou excluir sua conta. A exclusão remove
          permanentemente o espaço financeiro e o histórico dos dois membros; a
          outra pessoa perde acesso aos dados do casal, mas mantém a própria
          conta. Faça a exportação antes de confirmar. Cópias técnicas de backup
          podem permanecer temporariamente conforme o ciclo de retenção do
          provedor.
        </p>
        <p className="notice">
          Dúvidas ou solicitações sobre privacidade: contact@magaltec.com.br.
          Esta versão ainda está em desenvolvimento e não substitui orientação
          financeira profissional.
        </p>
        <Link className="button secondary" href="/login">
          Voltar ao acesso
        </Link>
      </article>
    </main>
  );
}
