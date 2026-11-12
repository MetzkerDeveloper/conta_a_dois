'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { preparePasswordLogin } from '../actions';

const schema = z.object({
  email: z.email('Informe um e-mail válido.').max(254),
  password: z.string().max(128),
  name: z.string().trim().max(60),
});
export function LoginForm({
  returnPath,
  linkError,
}: {
  returnPath: string;
  linkError: boolean;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(
    linkError ? 'O link expirou ou é inválido. Solicite outro.' : '',
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', password: '' },
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (data) => {
        setError('');
        setMessage('');
        try {
          if (mode === 'reset') {
            const result = await authClient.requestPasswordReset({
              email: data.email,
              redirectTo: `/senha?next=${encodeURIComponent(returnPath)}`,
            });
            if (result.error) throw new Error();
            setMessage(
              'Se houver uma conta com este e-mail, enviaremos um link para cadastrar uma nova senha.',
            );
            return;
          }
          if (mode === 'signup') {
            if (!data.name || data.password.length < 8) {
              setError(
                'Informe seu nome e uma senha com pelo menos 8 caracteres.',
              );
              return;
            }
            const result = await authClient.signUp.email({
              ...data,
              callbackURL: `/login?next=${encodeURIComponent(returnPath)}`,
            });
            if (result.error) throw new Error();
            setMessage(
              'Confira seu e-mail para verificar sua conta. Depois, entre com sua senha.',
            );
            return;
          }
          if (await preparePasswordLogin(data.email, returnPath)) {
            setMessage(
              'Se houver uma conta sem senha com este e-mail, enviaremos um link para cadastrá-la. Abra o link para continuar.',
            );
            return;
          }
          const result = await authClient.signIn.email({
            email: data.email,
            password: data.password,
            callbackURL: returnPath,
          });
          if (result.error) {
            setError(
              'Confira e-mail e senha. Se ainda não tem senha, use “Cadastrar ou recuperar senha”. Verifique também seu e-mail se a conta for nova.',
            );
            return;
          }
          window.location.assign(returnPath);
        } catch {
          setError(
            'Não foi possível concluir agora. Aguarde um minuto e tente novamente.',
          );
        }
      })}
    >
      {mode === 'signup' && (
        <>
          <label htmlFor="login-name">Seu nome</label>
          <input
            id="login-name"
            autoComplete="given-name"
            {...register('name')}
          />
        </>
      )}
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        {...register('email')}
        aria-invalid={!!errors.email}
        aria-describedby={errors.email ? 'login-email-error' : undefined}
      />
      {errors.email && (
        <p id="login-email-error" className="field-error" role="alert">
          {errors.email.message}
        </p>
      )}
      {mode !== 'reset' && (
        <>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete={
              mode === 'signup' ? 'new-password' : 'current-password'
            }
            {...register('password')}
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <p className="field-error" role="alert">
              {errors.password.message}
            </p>
          )}
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <button
        type="submit"
        className="button primary full-width auth-submit"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? 'Aguarde…'
          : mode === 'signup'
            ? 'Criar conta'
            : mode === 'reset'
              ? 'Enviar e-mail para cadastrar senha'
              : 'Entrar'}
      </button>
      <div className="account-links">
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setMode(mode === 'signup' ? 'login' : 'signup');
            setError('');
            setMessage('');
          }}
        >
          {mode === 'signup' ? 'Já tenho conta' : 'Criar conta'}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setMode(mode === 'reset' ? 'login' : 'reset');
            setError('');
            setMessage('');
          }}
        >
          {mode === 'reset'
            ? 'Voltar ao login'
            : 'Cadastrar ou recuperar senha'}
        </button>
      </div>
    </form>
  );
}
