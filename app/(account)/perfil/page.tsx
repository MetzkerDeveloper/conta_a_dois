import Link from 'next/link';
import { LockKeyhole, Palette, UserRound } from 'lucide-react';
import { requireUser } from '@/features/household/queries';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { ThemePreference } from '@/features/profile/components/theme-preference';

export default async function ProfilePage() {
  const user = await requireUser('/perfil');
  return (
    <div className="profile-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sua conta</p>
          <h1>Meu perfil</h1>
          <p className="muted">
            Cuide do seu acesso e deixe o espaço com a sua cara.
          </p>
        </div>
      </div>
      <Link className="text-link" href="/casal">
        Voltar para o painel
      </Link>
      <section
        className="panel account-card"
        aria-labelledby="profile-account-title"
      >
        <h2 id="profile-account-title">
          <UserRound size={20} />
          Dados da conta
        </h2>
        <dl className="profile-details">
          <div>
            <dt>Nome</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>
      </section>
      <section
        className="panel account-card"
        aria-labelledby="profile-appearance-title"
      >
        <h2 id="profile-appearance-title">
          <Palette size={20} />
          Aparência
        </h2>
        <p className="muted">
          Escolha como prefere visualizar o sistema. A preferência fica salva
          neste navegador.
        </p>
        <ThemePreference />
      </section>
      <section
        className="panel account-card"
        aria-labelledby="profile-password-title"
      >
        <h2 id="profile-password-title">
          <LockKeyhole size={20} />
          Trocar senha
        </h2>
        <p className="muted">
          Confirme sua senha atual para criar uma nova. Após a troca, os outros
          dispositivos serão desconectados.
        </p>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
