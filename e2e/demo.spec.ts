import { expect, test } from '@playwright/test';

test('inclui conta pendente e recalcula o repasse sem perder o estado entre telas', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Tudo às claras.' }),
  ).toBeVisible();
  await expect(page.locator('.transfer-value')).toHaveText(/1\.200,00/);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  await page.getByLabel('Descrição', { exact: true }).fill('Conta de água');
  await page.getByLabel('Valor (R$)', { exact: true }).fill('100,00');
  await page.getByLabel('Vencimento', { exact: true }).fill('2026-11-22');
  await page.getByLabel('Quem pagou?', { exact: true }).selectOption('pending');
  await page.getByRole('button', { name: 'Adicionar despesa' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.transfer-value')).toHaveText(/1\.130,00/);
  await expect(
    page.locator('.stat').filter({ hasText: 'Ainda falta pagar' }),
  ).toContainText(/100,00/);
  await page.getByRole('link', { name: 'Despesas', exact: true }).click();
  await expect(page.getByText('Conta de água', { exact: true })).toBeVisible();
  await page.getByLabel('Filtrar por categoria').selectOption('Moradia');
  await expect(
    page.getByText('Conta de água', { exact: true }),
  ).not.toBeVisible();
  await page.getByLabel('Filtrar por categoria').selectOption('Todas');
  await page.getByRole('button', { name: 'Excluir Conta de água' }).click();
  await expect(
    page.getByText('Conta de água', { exact: true }),
  ).not.toBeVisible();
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.transfer-value')).toHaveText(/1\.200,00/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('altera regra e rendas e restaura o exemplo', async ({ page }) => {
  await page.goto('/ajustes');
  await page.getByLabel('Como dividir as despesas?').selectOption('equal');
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.transfer-value')).toHaveText(/2\.000,00/);
  await page.goto('/rendas');
  await page.getByLabel('Ana · renda líquida (R$)').fill('3.000,00');
  await page.getByLabel('Bruno · renda líquida (R$)').fill('7.000,00');
  await page.getByRole('button', { name: 'Atualizar rendas' }).click();
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.transfer-value')).toHaveText(/2\.800,00/);
  await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
  await page.getByRole('button', { name: 'Restaurar exemplo' }).click();
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.transfer-value')).toHaveText(/1\.200,00/);
});
