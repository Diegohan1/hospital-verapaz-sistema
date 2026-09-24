import { test, expect } from '@playwright/test';

test.describe('Registro y Admisión - Navegación y UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@hospitalverapaz.gt');
    await page.fill('input[type="password"]', 'CambiarEsta123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\//);
  });

  test('Pestaña Paciente nuevo visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Paciente nuevo")')).toBeVisible();
    await expect(page.locator('text=+ Paciente nuevo')).toBeVisible();
  });

  test('Pestaña Ingreso / Egreso visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Ingreso / Egreso")')).toBeVisible();
  });

  test('Pestaña Pacientes registrados visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Pacientes registrados")')).toBeVisible();
  });

  test('Botón Escanear documento en pestaña Paciente nuevo', async ({ page }) => {
    await expect(page.locator('button:has-text("Escanear documento")')).toBeVisible();
  });

  test('Formulario de nuevo paciente tiene campos requeridos', async ({ page }) => {
    // Verificar campos clave del formulario
    await expect(page.locator('input[name="nombreCompleto"]')).toBeVisible();
    await expect(page.locator('input[name="dpi"]')).toBeVisible();
    await expect(page.locator('select[name="sexo"]')).toBeVisible();
    await expect(page.locator('select[name="tipoSangre"]')).toBeVisible();
    await expect(page.locator('input[name="telefono"]')).toBeVisible();
  });
});