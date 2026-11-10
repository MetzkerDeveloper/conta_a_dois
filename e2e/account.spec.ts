import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext } from '@playwright/test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '../db/schema';
import { createAuth } from '../lib/auth-factory';
import {
  createHousehold,
  createHouseholdInvite,
  acceptHouseholdInvite,
} from '../features/household/service';
import {
  saveIncome,
  createExpense,
  getMonthlyFinance,
} from '../features/finance/service';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test'))
  throw new Error('TEST_DATABASE_URL deve apontar para um banco de teste.');
const pool = new Pool({ connectionString, max: 2 });
const db = drizzle({ client: pool, schema });
const baseURL = 'http://127.0.0.1:3101';

test.beforeAll(async () => {
  await migrate(db, { migrationsFolder: './db/migrations' });
});
test.beforeEach(async () => {
  await db.delete(schema.rateLimit);
});
test.afterAll(async () => {
  await pool.end();
});

// Usa a mesma configuração de auth do app, sem rota de bypass ou envio real.
// O login por link e seu cookie são emitidos pelo Better Auth sobre o banco de teste.
async function signIn(context: BrowserContext, name: string) {
  let url = '';
  const auth = createAuth({
    db,
    baseURL,
    secret: 'e2e-local-secret-with-more-than-32-characters',
    sendMagicLink: async (message) => {
      url = message.url;
    },
  });
  const result = await auth.handler(
    new Request(`${baseURL}/api/auth/sign-in/magic-link`, {
      method: 'POST',
      headers: { origin: baseURL, 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `${randomUUID()}@example.test`,
        name,
        callbackURL: '/casal',
      }),
    }),
  );
  expect(result.status).toBe(200);
  const verified = await auth.handler(new Request(url));
  const cookie = verified.headers
    .getSetCookie()
    .find((value) => value.startsWith('better-auth.session_token='))!
    .split(';')[0]!;
  const separator = cookie.indexOf('=');
  await context.addCookies([
    {
      name: cookie.slice(0, separator),
      value: cookie.slice(separator + 1),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  return (await auth.api.getSession({ headers: new Headers({ cookie }) }))!.user
    .id;
}

test('cria casal, aceita convite e usa rendas e despesas reais com as duas sessões', async ({
  page,
  context,
  browser,
}, testInfo) => {
  await signIn(context, 'Ana');
  await page.goto('/casal');
  await expect(page).toHaveURL(/\/comecar$/);
  await page
    .getByLabel('Nome do espaço', { exact: true })
    .fill('Nossa casa de teste');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar nosso espaço' }).click();
  await expect(page).toHaveURL(/\/casal$/, { timeout: 30_000 });
  await expect(
    page.getByRole('heading', { name: 'Nossa casa de teste', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Gerar convite', exact: true })
    .click();
  const inviteInput = page.getByLabel('Link do convite', { exact: true });
  await expect(inviteInput).toBeVisible();
  const url = await inviteInput.inputValue();
  const partner = await browser.newContext({ viewport: page.viewportSize() });
  try {
    await signIn(partner, 'Bruno');
    const partnerPage = await partner.newPage();
    await partnerPage.goto(url);
    await partnerPage.getByRole('checkbox').check();
    await partnerPage
      .getByRole('button', { name: 'Aceitar convite e entrar' })
      .click();
    await expect(partnerPage).toHaveURL(/\/casal$/, { timeout: 30_000 });
    await expect(partnerPage.locator('.household-people')).toContainText('Ana');
    await expect(partnerPage.locator('.household-people')).toContainText(
      'Bruno',
    );
    await expect(
      partnerPage.getByRole('button', { name: 'Gerar convite', exact: true }),
    ).not.toBeVisible();
    await page.reload();
    await expect(page.locator('.household-people li')).toHaveCount(2);
    expect(
      await partnerPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto('/casal/rendas?mes=2026-11');
    await page
      .getByLabel('Sua renda líquida (R$)', { exact: true })
      .fill('7.000,00');
    await page
      .getByRole('button', { name: 'Confirmar minha renda', exact: true })
      .click();
    await expect(
      page.getByText('Renda confirmada nesta competência.', { exact: true }),
    ).toBeVisible();
    await partnerPage.goto('/casal/rendas?mes=2026-11');
    await partnerPage
      .getByLabel('Sua renda líquida (R$)', { exact: true })
      .fill('3.000,00');
    await partnerPage
      .getByRole('button', { name: 'Confirmar minha renda', exact: true })
      .click();
    await expect(
      partnerPage.getByText('Renda confirmada nesta competência.', {
        exact: true,
      }),
    ).toHaveCount(2);
    await page.goto('/casal?mes=2026-11');
    await page
      .getByRole('link', { name: 'Lançar despesa', exact: true })
      .click();
    await page.getByLabel('Descrição', { exact: true }).fill('Aluguel real');
    await page.getByLabel('Valor (R$)', { exact: true }).fill('4.000,00');
    await page
      .getByLabel('Categoria', { exact: true })
      .selectOption({ label: 'Moradia' });
    await page
      .getByLabel('Quem pagou?', { exact: true })
      .selectOption({ label: 'Ana' });
    await page
      .getByRole('button', { name: 'Salvar despesa', exact: true })
      .click();
    await expect(page.getByTestId('real-expense-row')).toHaveCount(1);
    await page.reload();
    await expect(page.getByText('Aluguel real', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Painel', exact: true }).click();
    await expect(page.getByTestId('suggested-transfer')).toHaveText(
      /1\.200,00/,
    );
    await page.screenshot({
      path: testInfo.outputPath('painel-real.png'),
      fullPage: true,
    });
    await partnerPage.goto('/casal?mes=2026-11');
    await expect(partnerPage.getByTestId('suggested-transfer')).toHaveText(
      /1\.200,00/,
    );
    await partnerPage
      .getByRole('link', { name: 'Despesas', exact: true })
      .click();
    await partnerPage
      .getByRole('link', { name: 'Editar Aluguel real', exact: true })
      .click();
    await partnerPage
      .getByLabel('Valor (R$)', { exact: true })
      .fill('4.000,01');
    await partnerPage
      .getByLabel('Quem pagou?', { exact: true })
      .selectOption({ label: 'Bruno' });
    await partnerPage
      .getByLabel('Observações (opcional)', { exact: true })
      .fill('Pagamento atualizado pelo parceiro');
    await partnerPage
      .getByRole('button', { name: 'Salvar alterações', exact: true })
      .click();
    await expect(
      partnerPage.getByText('Pagamento atualizado pelo parceiro', {
        exact: true,
      }),
    ).toBeVisible();
    await partnerPage
      .getByRole('link', { name: 'Painel', exact: true })
      .click();
    await expect(partnerPage.getByTestId('suggested-transfer')).toHaveText(
      /2\.800,01/,
    );
    await page.reload();
    await expect(page.getByTestId('suggested-transfer')).toHaveText(
      /2\.800,01/,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await partnerPage
      .getByRole('link', { name: 'Ajustes', exact: true })
      .click();
    await partnerPage
      .getByLabel('Percentual de quem tem a maior renda', { exact: true })
      .fill('60');
    await partnerPage
      .getByLabel('Pagador responsável', { exact: true })
      .selectOption({ label: 'Bruno' });
    await partnerPage
      .getByRole('button', { name: 'Salvar combinado', exact: true })
      .click();
    await expect(
      partnerPage.getByText('Combinado salvo.', { exact: false }),
    ).toBeVisible();
    await partnerPage
      .getByRole('link', { name: 'Painel', exact: true })
      .click();
    await expect(partnerPage.getByTestId('suggested-transfer')).toHaveText(
      /2\.800,01/,
    );
    await partnerPage.goto('/casal/despesas/nova?mes=2026-12');
    await expect(
      partnerPage.getByLabel('Quem pagou?', { exact: true }),
    ).not.toHaveValue('');
    await partnerPage.goto('/casal/despesas?mes=2026-11');
    await partnerPage
      .getByLabel('Pagamento', { exact: true })
      .selectOption('pending');
    await partnerPage
      .getByRole('button', { name: 'Filtrar', exact: true })
      .click();
    await expect(partnerPage.getByTestId('real-expense-row')).toHaveCount(0);
    await partnerPage.getByLabel('Pagamento', { exact: true }).selectOption('');
    await partnerPage
      .getByRole('button', { name: 'Filtrar', exact: true })
      .click();
    await partnerPage
      .getByRole('button', { name: 'Excluir Aluguel real', exact: true })
      .click();
    await partnerPage
      .getByRole('button', { name: 'Confirmar exclusão', exact: true })
      .click();
    await expect(partnerPage.getByTestId('real-expense-row')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('month-total')).toHaveText(/0,00/);
    await partnerPage
      .getByRole('button', { name: 'Sair', exact: true })
      .click();
    await expect(partnerPage).toHaveURL(/\/login$/);
    await partnerPage.goto('/casal');
    await expect(partnerPage).toHaveURL(/\/login/);
  } finally {
    await partner.close();
  }
});

test('mostra renda somada, aplica sugestão e restaura a divisão pelo painel', async ({
  page,
  context,
  browser,
}, testInfo) => {
  const ana = await signIn(context, 'Ana');
  const partnerContext = await browser.newContext({
    baseURL,
    viewport: testInfo.project.use.viewport,
  });
  try {
    const bruno = await signIn(partnerContext, 'Bruno');
    await createHousehold(db, ana, {
      name: 'Casa redistribuída',
      displayName: 'Ana',
      splitMode: 'equal',
      higherShareBps: 7000,
      transferDay: 25,
      consent: true,
    });
    const invite = await createHouseholdInvite(db, ana);
    await acceptHouseholdInvite(db, bruno, {
      token: invite.token,
      displayName: 'Bruno',
      consent: true,
    });
    await saveIncome(db, ana, {
      month: '2026-11',
      amount: '1.000,00',
      version: 0,
    });
    await saveIncome(db, bruno, {
      month: '2026-11',
      amount: '3.000,00',
      version: 0,
    });
    const data = await getMonthlyFinance(db, ana, '2026-11');
    await createExpense(db, ana, {
      month: '2026-11',
      description: 'Moradia',
      amount: '3.000,00',
      dueDate: '2026-11-10',
      categoryId: data.categories[0]!.id,
      paidByUserId: bruno,
      notes: '',
      creationKey: randomUUID(),
    });
    await page.goto('/casal?mes=2026-11');
    await expect(page.getByTestId('household-income-total')).toContainText(
      '4.000,00',
    );
    await expect(page.getByTestId('month-total')).toContainText('3.000,00');
    const suggestion = page.getByRole('region', {
      name: 'Sugestão de redistribuição',
    });
    await expect(suggestion).toContainText('500,00');
    await expect(page.getByTestId('suggested-transfer')).toContainText(
      '1.500,00',
    );
    await suggestion
      .getByRole('button', { name: 'Aplicar redistribuição' })
      .click();
    await expect(suggestion.getByRole('heading')).toHaveText(
      'Redistribuição aplicada neste mês',
    );
    await expect(page.getByTestId('suggested-transfer')).toContainText(
      '1.000,00',
    );
    await page.reload();
    await expect(
      suggestion.getByRole('button', { name: 'Restaurar divisão original' }),
    ).toBeVisible();
    await expect(page.getByTestId('suggested-transfer')).toContainText(
      '1.000,00',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('painel-redistribuicao.png'),
      fullPage: true,
    });
    await suggestion
      .getByRole('button', { name: 'Restaurar divisão original' })
      .click();
    await expect(page.getByTestId('suggested-transfer')).toContainText(
      '1.500,00',
    );
  } finally {
    await partnerContext.close();
  }
});
