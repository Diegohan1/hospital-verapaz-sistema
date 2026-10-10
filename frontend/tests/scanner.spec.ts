import { test, expect } from '@playwright/test';

test.describe('Escáner Documental - UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@hospitalverapaz.gt');
    await page.fill('input[type="password"]', process.env.SEED_ADMIN_PASSWORD || 'CambiarEsta123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\//);
  });

  test('Botón para escanear el expediente visible en Registro', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Escanear en esta computadora/ })).toBeVisible();
  });

  test('Modal de escáner se abre', async ({ page }) => {
    await page.getByRole('button', { name: /Escanear en esta computadora/ }).click();
    await expect(page.getByRole('heading', { name: 'Escanear documento del paciente' })).toBeVisible();
  });

  test('Input de archivo visible en modal', async ({ page }) => {
    await page.getByRole('button', { name: /Escanear en esta computadora/ }).click();
    await expect(page.getByLabel('Subir imagen o PDF del documento')).toBeAttached();
  });
});
