import { test, expect } from '@playwright/test';

test.describe('Autenticación y login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
  });

  test('Login exitoso con credenciales válidas', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@hospitalverapaz.gt');
    await page.fill('input[type="password"]', 'CambiarEsta123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\//);
    // Verificar que estamos en la página de registro usando el heading principal
    await expect(page.locator('h1:has-text("Registro y Admisión")')).toBeVisible({ timeout: 10000 });
  });

  test('Login fallido con credenciales inválidas', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@hospitalverapaz.gt');
    await page.fill('input[type="password"]', 'contraseña_incorrecta');
    await page.click('button[type="submit"]');
    // Buscar cualquier banner de error
    await expect(page.locator('[class*="banner"]:has-text("Credenciales")')).toBeVisible({ timeout: 10000 });
  });

  test('Enlace de recuperación de contraseña', async ({ page }) => {
    await page.click('a:has-text("¿Olvidó su contraseña?")');
    await expect(page).toHaveURL(/.*recuperar/);
    await expect(page.locator('text=Recuperar contraseña')).toBeVisible();
  });
});