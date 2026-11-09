'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <div>
      <button
        className="button secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError('');
          try {
            const result = await authClient.signOut();
            if (result.error) throw new Error();
            router.replace('/login');
            router.refresh();
          } catch {
            setError('Não foi possível sair agora. Tente novamente.');
            setPending(false);
          }
        }}
      >
        <LogOut size={16} />
        {pending ? 'Saindo…' : 'Sair'}
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
