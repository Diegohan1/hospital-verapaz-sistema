import { test, expect } from '@playwright/test';

test.describe('Escáner Documental - UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@hospitalverapaz.gt');
    await page.fill('input[type="password"]', 'CambiarEsta123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\//);
  });

  test('Botón Escanear documento visible en Expediente', async ({ page }) => {
    await page.click('aside >> text=Expediente Clínico');
    await expect(page).toHaveURL(/.*expediente/);
    await expect(page.locator('button:has-text("Escanear documento")')).toBeVisible();
  });

  test('Modal de escáner se abre', async ({ page }) => {
    await page.click('aside >> text=Expediente Clínico');
    await expect(page.locator('button:has-text("Escanear documento")')).toBeVisible();
    await page.click('button:has-text("Escanear documento")');
    await expect(page.locator('text=Escanear documento')).toBeVisible({ timeout: 5000 });
  });

  test('Input de archivo visible en modal', async ({ page }) => {
    await page.click('aside >> text=Expediente Clínico');
    await page.click('button:has-text("Escanear documento")');
    await expect(page.locator('input[type="file"]')).toBeVisible({ timeout: 5000 });
  });
});