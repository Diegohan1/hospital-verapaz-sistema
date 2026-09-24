import { test, expect } from '@playwright/test';

test.describe('Expediente Clínico - Navegación', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@hospitalverapaz.gt');
    await page.fill('input[type="password"]', 'CambiarEsta123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\//);
  });

  test('Navegación a Expediente Clínico', async ({ page }) => {
    // Hacer clic en el menú lateral
    await page.click('aside >> text=Expediente Clínico');
    await expect(page).toHaveURL(/.*expediente/);
    await expect(page.locator('text=Expediente Clínico')).toBeVisible({ timeout: 10000 });
  });

  test('Botón Ver diagnóstico requiere paciente', async ({ page }) => {
    await page.click('aside >> text=Expediente Clínico');
    await expect(page).toHaveURL(/.*expediente/);
    // El botón Ver diagnóstico debería estar deshabilitado sin paciente seleccionado
    await expect(page.locator('button:has-text("Ver diagnóstico")')).toBeDisabled();
  });
});