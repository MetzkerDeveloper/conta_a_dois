'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Mail } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { loginSchema } from '../schema';

export function LoginForm({
  returnPath,
  linkError,
}: {
  returnPath: string;
  linkError: boolean;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(
    linkError
      ? 'Este link expirou ou já foi usado. Solicite um novo acesso.'
      : '',
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (data) => {
        setError('');
        try {
          const response = await authClient.signIn.magicLink({
            email: data.email,
            name: data.name,
            callbackURL: returnPath,
            newUserCallbackURL: returnPath,
            errorCallbackURL: `/login?erro=link&next=${encodeURIComponent(returnPath)}`,
          });
          if (response.error) {
            setError(
              'Não foi possível enviar o acesso agora. Aguarde um minuto e tente novamente.',
            );
            return;
          }
          setSent(true);
        } catch {
          setError(
            'Não foi possível conectar. Confira sua conexão e tente novamente.',
          );
        }
      })}
    >
      <label htmlFor="login-name">Seu nome</label>
      <input
        id="login-name"
        autoComplete="given-name"
        {...register('name')}
        aria-invalid={!!errors.name}
        aria-describedby={errors.name ? 'name-error' : undefined}
      />
      {errors.name && (
        <p id="name-error" className="field-error">
          {errors.name.message}
        </p>
      )}
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        {...register('email')}
        aria-invalid={!!errors.email}
        aria-describedby={errors.email ? 'email-error' : undefined}
      />
      {errors.email && (
        <p id="email-error" className="field-error">
          {errors.email.message}
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="notice auth-notice">
          Confira sua caixa de entrada. O link de acesso vale por 10 minutos e
          pode ser usado uma única vez.
        </p>
      )}
      <button
        className="button primary full-width auth-submit"
        type="submit"
        disabled={isSubmitting}
      >
        <Mail size={17} />
        {isSubmitting
          ? 'Enviando acesso…'
          : sent
            ? 'Enviar outro link'
            : 'Receber link de acesso'}
      </button>
      <p className="form-note muted">
        Você não precisa criar uma senha. No primeiro acesso, vamos pedir sua
        concordância com a política de privacidade antes de criar ou entrar no
        casal.
      </p>
    </form>
  );
}
