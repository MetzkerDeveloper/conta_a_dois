import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { requireUser } from '@/features/household/queries';
import { getHouseholdForUser } from '@/features/household/service';
import { HouseholdForm } from '@/features/household/components/household-form';

export default async function StartPage() {
  const user = await requireUser();
  if (await getHouseholdForUser(getDb(), user.id)) redirect('/casal');
  return (
    <section className="panel account-card onboarding-card">
      <p className="eyebrow">Primeiro passo</p>
      <h1>O espaço de vocês.</h1>
      <p className="muted">
        Comece pela regra que faz sentido para o casal. Depois, convide a outra
        pessoa.
      </p>
      <HouseholdForm name={user.name} />
    </section>
  );
}
