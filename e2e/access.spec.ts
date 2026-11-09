import { expect, test } from '@playwright/test';

test('exige autenticação antes de abrir o casal ou um convite', async ({
  page,
}) => {
  await page.goto('/casal');
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole('heading', { name: 'Contas em dia. A dois.' }),
  ).toBeVisible();
  await page.goto(`/convite/${'a'.repeat(64)}`);
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole('heading', { name: 'Quem faz parte' }),
  ).not.toBeVisible();
  await page.goto('/privacidade');
  await expect(
    page.getByRole('heading', { name: 'Privacidade, com clareza.' }),
  ).toBeVisible();
});
