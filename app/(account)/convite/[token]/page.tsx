import Link from 'next/link';
import { getDb } from '@/db';
import { requireUser } from '@/features/household/queries';
import {
  getHouseholdForUser,
  getInvitePreview,
} from '@/features/household/service';
import { HouseholdForm } from '@/features/household/components/household-form';

export const metadata = { referrer: 'no-referrer' as const };
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await requireUser(`/convite/${token}`);
  const existing = await getHouseholdForUser(getDb(), user.id);
  if (existing)
    return (
      <section className="panel account-card">
        <h1>Você já tem um espaço.</h1>
        <p className="muted">Cada pessoa pode fazer parte de um casal.</p>
        <Link className="button primary auth-submit" href="/casal">
          Ver meu casal
        </Link>
      </section>
    );
  const preview = await getInvitePreview(getDb(), token);
  if (!preview)
    return (
      <section className="panel account-card">
        <h1>Este convite não está disponível.</h1>
        <p className="muted">
          Ele pode ter expirado, já ter sido usado ou ter sido substituído. Peça
          um novo link para seu par.
        </p>
      </section>
    );
  return (
    <section className="panel account-card onboarding-card">
      <p className="eyebrow">Um convite para vocês</p>
      <h1>Entre em {preview.householdName}.</h1>
      <p className="muted">
        Ao aceitar, vocês passam a compartilhar as informações financeiras deste
        espaço.
      </p>
      <HouseholdForm name={user.name} token={token} />
    </section>
  );
}
