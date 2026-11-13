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
  payExpense,
  updateExpense,
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

// Usa o Better Auth real e captura a verificação de e-mail em memória.
async function credentials(name: string) {
  let url = '';
  const email = `${randomUUID()}@example.test`;
  const password = 'Senha-de-teste-123';
  const auth = createAuth({
    db,
    baseURL,
    secret: 'e2e-local-secret-with-more-than-32-characters',
    sendMagicLink: async () => {},
    sendAccountEmail: async (message) => {
      url = message.url;
    },
  });
  const created = await auth.api.signUpEmail({
    body: { email, password, name },
  });
  await auth.handler(new Request(url));
  return {
    auth,
    email,
    password,
    userId: created.user.id,
    deliveredURL: () => url,
  };
}
async function signIn(context: BrowserContext, name: string) {
  const { auth, email, password, userId } = await credentials(name);
  const response = await auth.handler(
    new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { origin: baseURL, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  );
  expect(response.status).toBe(200);
  const cookie = response.headers
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
  return userId;
}

test('entra pela tela de e-mail e senha e exibe recuperação sem exigir senha', async ({
  page,
}) => {
  const { email, password } = await credentials('Ana');
  await page.goto('/login');
  await page
    .getByRole('button', { name: 'Cadastrar ou recuperar senha', exact: true })
    .click();
  await expect(page.getByLabel('Senha', { exact: true })).not.toBeVisible();
  await page
    .getByRole('button', { name: 'Voltar ao login', exact: true })
    .click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/comecar$/, { timeout: 30_000 });
  await expect(
    page.getByRole('heading', { name: 'O espaço de vocês.' }),
  ).toBeVisible();
});

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
      .getByRole('button', { name: 'Salvar minha renda', exact: true })
      .click();
    await expect(
      page.getByText('Renda disponível nesta competência.', { exact: true }),
    ).toBeVisible();
    await partnerPage.goto('/casal/rendas?mes=2026-11');
    await partnerPage
      .getByLabel('Sua renda líquida (R$)', { exact: true })
      .fill('3.000,00');
    await partnerPage
      .getByRole('button', { name: 'Salvar minha renda', exact: true })
      .click();
    await expect(
      partnerPage.getByText('Renda disponível nesta competência.', {
        exact: true,
      }),
    ).toHaveCount(2);
    await page.goto('/casal/rendas?mes=2026-12');
    await expect(
      page.getByLabel('Sua renda líquida (R$)', { exact: true }),
    ).toHaveValue('7000,00');
    await page
      .getByRole('button', { name: 'Adicionar renda extra', exact: true })
      .click();
    await page
      .getByLabel('Valor da renda extra 1 (R$)', { exact: true })
      .fill('500,00');
    await page
      .getByLabel('Descrição (opcional)', { exact: true })
      .fill('Bônus');
    await page
      .getByRole('button', { name: 'Adicionar renda extra', exact: true })
      .click();
    await page
      .getByLabel('Valor da renda extra 2 (R$)', { exact: true })
      .fill('250,00');
    await page
      .getByRole('button', { name: 'Salvar minha renda', exact: true })
      .click();
    await expect(page.locator('.income-value').first()).toHaveText(/7\.750,00/);
    await page.reload();
    await expect(
      page.getByLabel('Valor da renda extra 1 (R$)', { exact: true }),
    ).toHaveValue('500,00');
    await expect(
      page.getByLabel('Valor da renda extra 2 (R$)', { exact: true }),
    ).toHaveValue('250,00');
    await expect(
      page.getByLabel('Descrição (opcional)', { exact: true }).first(),
    ).toHaveValue('Bônus');
    await page
      .getByRole('button', { name: 'Remover renda extra 1', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Salvar minha renda', exact: true })
      .click();
    await expect(page.locator('.income-value').first()).toHaveText(/7\.250,00/);
    await page.reload();
    await expect(
      page.getByLabel('Valor da renda extra 1 (R$)', { exact: true }),
    ).toHaveValue('250,00');
    await expect(
      page.getByRole('group', { name: 'Renda extra 2', exact: true }),
    ).toHaveCount(0);
    await page.goto('/casal/rendas?mes=2027-01');
    await expect(
      page.getByLabel('Sua renda líquida (R$)', { exact: true }),
    ).toHaveValue('7000,00');
    await expect(
      page.getByText('Nenhuma renda extra cadastrada neste mês.', {
        exact: true,
      }),
    ).toBeVisible();
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
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect
      .poll(
        async () => (await page.locator('.account-header').boundingBox())?.y,
      )
      .toBe(0);
    await expect(
      page.getByRole('button', { name: 'Sair', exact: true }),
    ).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 0));
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
    await partnerPage.goto('/casal/despesas/nova?mes=2027-01');
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

test('busca, filtra e pagina despesas preservando a competência e os totais', async ({
  page,
  context,
}) => {
  const ana = await signIn(context, 'Ana');
  const household = await createHousehold(db, ana, {
    name: 'Lista paginada',
    displayName: 'Ana',
    splitMode: 'equal',
    higherShareBps: 7000,
    transferDay: 25,
    consent: true,
  });
  const data = await getMonthlyFinance(db, ana, '2026-11');
  const categoryId = data.categories[0]!.id;
  await createExpense(db, ana, {
    month: '2026-11',
    description: 'Conta energia 00',
    amount: '10,00',
    dueDate: '2026-11-05',
    categoryId,
    paidByUserId: ana,
    notes: '',
    creationKey: randomUUID(),
  });
  await db.insert(schema.expenses).values(
    Array.from({ length: 54 }, (_, offset) => {
      const i = offset + 1;
      return {
        householdId: household.id,
        month: '2026-11-01',
        description:
          i === 54
            ? 'Água condomínio'
            : `Conta energia ${String(i).padStart(2, '0')}`,
        amountCents: 1000,
        dueDate: '2026-11-05',
        categoryId,
        paidByUserId: i % 2 ? null : ana,
        paidAt: i % 2 ? null : new Date(),
        createdBy: ana,
        notes: '',
        creationKey: randomUUID(),
      };
    }),
  );
  await page.goto('/casal/despesas?mes=2026-11');
  const rows = page.getByTestId('real-expense-row');
  const pagination = page.getByRole('navigation', {
    name: 'Paginação de despesas',
  });
  await expect(rows).toHaveCount(25);
  await expect(page.locator('.finance-toolbar')).toContainText(
    '55 de 55 despesas',
  );
  await expect(page.locator('.finance-toolbar')).toContainText('550,00');
  await pagination.getByRole('link', { name: 'Próxima' }).click();
  await expect(pagination).toContainText('Página 2 de 3');
  await expect(rows).toHaveCount(25);
  await pagination.getByRole('link', { name: 'Próxima' }).click();
  await expect(rows).toHaveCount(5);
  await expect(pagination).toContainText('Página 3 de 3');
  await page.getByLabel('Buscar despesa').fill('energia');
  await page.getByLabel('Pagamento', { exact: true }).selectOption('pending');
  await page.getByLabel('Categoria', { exact: true }).selectOption(categoryId);
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await expect(rows).toHaveCount(25);
  await expect(page.locator('.expense-results')).toContainText(
    '27 despesas encontradas',
  );
  await expect(page.locator('.expense-results')).toContainText('270,00');
  await expect(pagination).toContainText('Página 1 de 2');
  await pagination.getByRole('link', { name: 'Próxima' }).click();
  await expect(rows).toHaveCount(2);
  await expect(page).toHaveURL(/busca=energia/);
  await expect(page).toHaveURL(/status=pending/);
  await expect(page).toHaveURL(/mes=2026-11/);
  await page.reload();
  await expect(rows).toHaveCount(2);
  await expect(page.getByLabel('Buscar despesa')).toHaveValue('energia');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Limpar filtros', exact: true }).click();
  await expect(rows).toHaveCount(25);
  await expect(page.getByLabel('Buscar despesa')).toHaveValue('');
  await expect(pagination).toContainText('Página 1 de 3');
  await page.getByLabel('Buscar despesa').fill('despesa inexistente');
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await expect(rows).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Nenhuma despesa por aqui.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Lançar primeira despesa' }),
  ).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Ver todas as despesas', exact: true })
    .click();
  await expect(rows).toHaveCount(25);
});

test('confirma pagamento pela lista sem perder filtros e atualiza ao voltar à aba', async ({
  page,
  context,
}) => {
  const ana = await signIn(context, 'Ana');
  await createHousehold(db, ana, {
    name: 'Pagamento rápido',
    displayName: 'Ana',
    splitMode: 'equal',
    higherShareBps: 7000,
    transferDay: 25,
    consent: true,
  });
  const data = await getMonthlyFinance(db, ana, '2026-11');
  const fields = {
    month: '2026-11',
    description: 'Conta direta',
    amount: '100,00',
    dueDate: '2026-11-05',
    categoryId: data.categories[0]!.id,
    paidByUserId: null,
    notes: '',
    creationKey: randomUUID(),
  };
  const first = await createExpense(db, ana, fields);
  await page.goto('/casal/despesas?mes=2026-11&busca=Conta');
  const row = page.getByTestId('real-expense-row');
  await row.getByRole('button', { name: 'Marcar como paga' }).click();
  await row.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(row.locator('.paid-label')).toHaveText('Pago por Ana');
  await expect(page).toHaveURL(/busca=Conta/);
  await expect(
    row.getByRole('button', { name: 'Marcar como paga' }),
  ).toHaveCount(0);
  const second = await createExpense(db, ana, {
    ...fields,
    description: 'Conta externa',
    creationKey: randomUUID(),
  });
  // A alteração no banco representa o pagamento feito em outra sessão.
  await payExpense(db, ana, {
    month: '2026-11',
    id: second.id,
    version: second.version,
    paidByUserId: ana,
  });
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('real-expense-row')).toHaveCount(2);
  await expect(page.locator('.paid-label')).toHaveCount(2);
  await expect(page).toHaveURL(/busca=Conta/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // Uma atualização externa não pode apagar uma edição ainda não enviada.
  await page.goto(`/casal/despesas/${first.id}/editar?mes=2026-11`);
  await page
    .getByLabel('Descrição', { exact: true })
    .fill('Minha edição não salva');
  const current = (await getMonthlyFinance(db, ana, '2026-11')).expenses.find(
    (item) => item.id === first.id,
  )!;
  await updateExpense(db, ana, {
    ...fields,
    paidByUserId: ana,
    id: first.id,
    version: current.version,
    description: 'Alterada em outra sessão',
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    page.getByText(
      'Atualização automática pausada para preservar os campos que você está editando.',
    ),
  ).toBeVisible();
  await expect(page.getByLabel('Descrição', { exact: true })).toHaveValue(
    'Minha edição não salva',
  );
});

test('cadastra nova senha por e-mail e usa a senha atualizada no login', async ({
  page,
}) => {
  const { auth, email, deliveredURL } = await credentials('Ana');
  await auth.api.requestPasswordReset({
    body: { email, redirectTo: '/senha?next=%2Fcasal' },
  });
  await page.goto(deliveredURL());
  const confirmationBox = await page
    .getByLabel('Repita a senha', { exact: true })
    .boundingBox();
  const saveBox = await page
    .getByRole('button', { name: 'Salvar senha', exact: true })
    .boundingBox();
  expect(
    saveBox!.y - (confirmationBox!.y + confirmationBox!.height),
  ).toBeGreaterThanOrEqual(20);

  await page
    .getByLabel('Nova senha', { exact: true })
    .fill('Senha-atualizada-456');
  await page
    .getByLabel('Repita a senha', { exact: true })
    .fill('Senha-diferente-789');
  await page.getByRole('button', { name: 'Salvar senha', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'As senhas devem ser iguais.' }),
  ).toBeVisible();
  await page
    .getByLabel('Repita a senha', { exact: true })
    .fill('Senha-atualizada-456');
  await page.getByRole('button', { name: 'Salvar senha', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Senha cadastrada.');
  await page
    .getByRole('link', { name: 'Voltar ao login', exact: true })
    .click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('Senha-atualizada-456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/comecar$/, { timeout: 30_000 });
});

test('explora evolução mensal e simula reserva sem confirmar dinheiro guardado', async ({
  page,
  context,
  browser,
}, testInfo) => {
  const ana = await signIn(context, 'Ana');
  const partnerContext = await browser.newContext({ baseURL });
  try {
    const bruno = await signIn(partnerContext, 'Bruno');
    await createHousehold(db, ana, {
      name: 'Casa com planos',
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
    for (const userId of [ana, bruno])
      await saveIncome(db, userId, {
        month: '2026-11',
        amount: '2.000,00',
        version: 0,
      });
    const data = await getMonthlyFinance(db, ana, '2026-11');
    await createExpense(db, ana, {
      month: '2026-11',
      description: 'Moradia',
      amount: '1.000,00',
      dueDate: '2026-11-10',
      categoryId: data.categories[0]!.id,
      paidByUserId: null,
      notes: '',
      creationKey: randomUUID(),
    });
    await page.goto('/casal/evolucao?mes=2026-11&periodo=6');
    await expect(
      page.getByRole('heading', { name: 'Evolução financeira' }),
    ).toBeVisible();
    const reserve = page.getByRole('region', { name: 'Simulador de reserva' });
    await expect(reserve).toContainText('1.500,00');
    await expect(reserve).toContainText('18.000,00');
    await expect(reserve).toContainText('4 meses para chegar');
    const slider = page.getByRole('slider');
    await slider.focus();
    await slider.press('End');
    await expect(reserve).toContainText('36.000,00');
    await page.getByRole('button', { name: /^outubro de 2026:/ }).click();
    await expect(slider).toBeDisabled();
    await expect(reserve).toContainText('O simulador fica disponível');
    await page.getByRole('button', { name: /^novembro de 2026:/ }).click();
    await expect(slider).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('evolucao-financeira.png'),
      fullPage: true,
    });
  } finally {
    await partnerContext.close();
  }
});

test('perfil troca a senha, revoga outras sessões e mantém a preferência de tema', async ({
  page,
  context,
  browser,
}, testInfo) => {
  const userId = await signIn(context, 'Ana do perfil');
  const { rows } = await pool.query<{ email: string }>(
    'select email from users where id = $1',
    [userId],
  );
  const other = await browser.newContext({ baseURL });
  try {
    const login = await other.request.post('/api/auth/sign-in/email', {
      headers: { origin: baseURL },
      data: { email: rows[0]!.email, password: 'Senha-de-teste-123' },
    });
    expect(login.ok()).toBe(true);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/perfil');
    await expect(
      page.getByRole('heading', { name: 'Meu perfil' }),
    ).toBeVisible();
    await expect(page.getByText(rows[0]!.email, { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    await page.getByRole('radio', { name: 'Claro', exact: true }).check();
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
    await page.getByRole('radio', { name: 'Escuro', exact: true }).check();
    await page.reload();
    await expect(
      page.getByRole('radio', { name: 'Escuro', exact: true }),
    ).toBeChecked();
    await page.goto('/privacidade');
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    await page.goto('/perfil');
    await page
      .getByLabel('Senha atual', { exact: true })
      .fill('Senha-incorreta-123');
    await page
      .getByLabel('Nova senha', { exact: true })
      .fill('Minha-nova-senha-456');
    await page
      .getByLabel('Confirme a nova senha', { exact: true })
      .fill('Minha-nova-senha-456');
    await page
      .getByRole('button', { name: 'Alterar senha', exact: true })
      .click();
    await expect(page.getByRole('alert')).toHaveText(
      'A senha atual está incorreta.',
    );
    await page
      .getByLabel('Senha atual', { exact: true })
      .fill('Senha-de-teste-123');
    await page
      .getByRole('button', { name: 'Alterar senha', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Senha alterada.');
    expect(
      await (await other.request.get('/api/auth/get-session')).json(),
    ).toBeNull();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Meu perfil' }),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Seguir o dispositivo' }).check();
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    await page.getByRole('radio', { name: 'Escuro', exact: true }).check();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: testInfo.outputPath('perfil-dark.png'),
      fullPage: true,
    });
    const oldLogin = await other.request.post('/api/auth/sign-in/email', {
      headers: { origin: baseURL },
      data: { email: rows[0]!.email, password: 'Senha-de-teste-123' },
    });
    expect(oldLogin.ok()).toBe(false);
    const newLogin = await other.request.post('/api/auth/sign-in/email', {
      headers: { origin: baseURL },
      data: { email: rows[0]!.email, password: 'Minha-nova-senha-456' },
    });
    expect(newLogin.ok()).toBe(true);
  } finally {
    await other.close();
  }
});

test('perfil exige login e preserva o retorno para a página', async ({
  page,
}) => {
  await page.goto('/perfil');
  await expect(page).toHaveURL(/\/login\?next=%2Fperfil/);
});
