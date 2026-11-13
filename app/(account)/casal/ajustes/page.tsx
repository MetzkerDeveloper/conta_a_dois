import Link from 'next/link';
import { RuleForm } from '@/features/finance/components/forms';
import { FinanceHeader } from '@/features/finance/components/header';
import { loadSettings, type SearchParams } from '@/features/finance/queries';
import { InviteCard } from '@/features/household/components/invite-card';
import { deleteAccountAction } from '@/features/household/actions';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await loadSettings(await searchParams);
  return (
    <>
      <FinanceHeader
        title="O combinado de vocês"
        description="Definam a divisão e quem costuma pagar as contas."
        month={data.month}
        path="/casal/ajustes"
      />
      <section className="panel account-card finance-form-card">
        <h2>Regra para competências sem lançamentos</h2>
        <RuleForm household={data.household} members={data.members} />
      </section>
      {data.members.length === 1 && <InviteCard />}
      <section className="panel account-card">
        <h2>Demonstração</h2>
        <p className="muted">
          O exemplo usa dados fictícios, separados das contas reais de vocês.
        </p>
        <Link className="text-link auth-submit" href="/">
          Abrir exemplo com dados fictícios
        </Link>
      </section>
      <section className="panel account-card">
        <h2>Seus dados</h2>
        <p className="muted">
          Baixe uma cópia do seu perfil e dos dados compartilhados do casal. O
          arquivo inclui rendas, despesas, repasses, regras e fechamentos.
        </p>
        <Link
          className="button secondary"
          href="/api/account/export"
          prefetch={false}
        >
          Baixar meus dados (JSON)
        </Link>
      </section>
      <section className="panel account-card danger-zone">
        <h2>Excluir conta e dados</h2>
        <p>
          A exclusão é imediata e irreversível. Ela apaga este perfil e todo o
          espaço financeiro compartilhado: seu par também perde acesso ao
          histórico e precisará criar outro casal. Baixe a cópia dos dados antes
          de continuar.
        </p>
        <form action={deleteAccountAction} className="privacy-delete-form">
          <label htmlFor="delete-confirmation">
            Para confirmar, digite <strong>EXCLUIR</strong>.
          </label>
          <input
            id="delete-confirmation"
            name="confirmation"
            autoComplete="off"
            required
            pattern="EXCLUIR"
            title="Digite EXCLUIR para confirmar."
          />
          <button className="button danger-button" type="submit">
            Excluir conta e dados do casal
          </button>
        </form>
      </section>
    </>
  );
}
