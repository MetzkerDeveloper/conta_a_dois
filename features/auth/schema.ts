import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.').max(254),
  name: z.string().trim().min(1, 'Informe seu nome.').max(60),
});
