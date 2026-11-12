'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
const schema = z
  .object({
    password: z.string().min(8, 'Use pelo menos 8 caracteres.').max(128),
    confirmation: z.string(),
  })
  .refine((v) => v.password === v.confirmation, {
    path: ['confirmation'],
    message: 'As senhas devem ser iguais.',
  });
export function PasswordForm({ token }: { token: string }) {
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (saved)
    return (
      <p role="status">
        Senha cadastrada. Volte ao login para entrar com e-mail e senha.
      </p>
    );
  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        setError('');
        try {
          const result = await authClient.resetPassword({
            token,
            newPassword: data.password,
          });
          if (result.error)
            setError(
              'O link expirou ou já foi usado. Solicite outro no login.',
            );
          else setSaved(true);
        } catch {
          setError('Não foi possível salvar agora. Tente novamente.');
        }
      })}
    >
      <label htmlFor="new-password">Nova senha</label>
      <input
        id="new-password"
        type="password"
        autoComplete="new-password"
        {...register('password')}
      />
      {errors.password && (
        <p className="field-error" role="alert">
          {errors.password.message}
        </p>
      )}
      <label htmlFor="confirmation">Repita a senha</label>
      <input
        id="confirmation"
        type="password"
        autoComplete="new-password"
        {...register('confirmation')}
      />
      {errors.confirmation && (
        <p className="field-error" role="alert">
          {errors.confirmation.message}
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={isSubmitting}>
        Salvar senha
      </button>
    </form>
  );
}
