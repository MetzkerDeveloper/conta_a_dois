'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { changePasswordSchema } from '../change-password-schema';
import { useHydrated } from '@/lib/use-hydrated';

export function ChangePasswordForm() {
  const hydrated = useHydrated();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
  });
  return (
    <form
      className="password-form"
      onSubmit={handleSubmit(async (values) => {
        setError('');
        setSaved(false);
        try {
          const result = await authClient.changePassword({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
            revokeOtherSessions: true,
          });
          if (result.error) {
            setError(
              result.error.code === 'INVALID_PASSWORD'
                ? 'A senha atual está incorreta.'
                : result.error.status === 401
                  ? 'Sua sessão expirou. Entre novamente para trocar a senha.'
                  : result.error.status === 429
                    ? 'Muitas tentativas. Aguarde um pouco e tente novamente.'
                    : 'Não foi possível trocar a senha. Confira a senha atual e tente novamente.',
            );
            return;
          }
          reset();
          setSaved(true);
        } catch {
          setError('Não foi possível trocar a senha agora. Tente novamente.');
        }
      })}
    >
      <fieldset
        disabled={isSubmitting || !hydrated}
        className="profile-password-fields"
      >
        <legend className="sr-only">Trocar senha</legend>
        <label htmlFor="profile-current-password">Senha atual</label>
        <input
          id="profile-current-password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          {...register('currentPassword')}
          aria-invalid={!!errors.currentPassword}
          aria-describedby={
            errors.currentPassword ? 'current-password-error' : undefined
          }
        />
        {errors.currentPassword && (
          <p id="current-password-error" className="field-error" role="alert">
            {errors.currentPassword.message}
          </p>
        )}
        <label htmlFor="profile-new-password">Nova senha</label>
        <input
          id="profile-new-password"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          {...register('newPassword')}
          aria-invalid={!!errors.newPassword}
          aria-describedby="password-hint new-password-error"
        />
        <small id="password-hint" className="muted">
          Use entre 8 e 128 caracteres.
        </small>
        {errors.newPassword && (
          <p id="new-password-error" className="field-error" role="alert">
            {errors.newPassword.message}
          </p>
        )}
        <label htmlFor="profile-password-confirmation">
          Confirme a nova senha
        </label>
        <input
          id="profile-password-confirmation"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          {...register('confirmation')}
          aria-invalid={!!errors.confirmation}
          aria-describedby={
            errors.confirmation ? 'password-confirmation-error' : undefined
          }
        />
        {errors.confirmation && (
          <p
            id="password-confirmation-error"
            className="field-error"
            role="alert"
          >
            {errors.confirmation.message}
          </p>
        )}
        <button
          type="submit"
          className="button primary"
          disabled={isSubmitting || !hydrated}
        >
          {isSubmitting ? 'Salvando…' : 'Alterar senha'}
        </button>
      </fieldset>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="notice" role="status">
          Senha alterada. Os outros dispositivos foram desconectados.
        </p>
      )}
      <Link className="text-link" href="/login">
        Esqueci minha senha ou ainda não tenho uma
      </Link>
    </form>
  );
}
