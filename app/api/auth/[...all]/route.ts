import { getAuth, isAuthConfigured } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(request: Request) {
  if (!isAuthConfigured())
    return Response.json(
      { message: 'O acesso ainda não está disponível.' },
      { status: 503 },
    );
  try {
    return await getAuth().handler(request);
  } catch {
    return Response.json(
      {
        message:
          'Não foi possível concluir o acesso. Tente novamente mais tarde.',
      },
      { status: 503 },
    );
  }
}
export const GET = handler;
export const POST = handler;
