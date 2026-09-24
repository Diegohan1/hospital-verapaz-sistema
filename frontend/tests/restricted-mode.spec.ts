import { test, expect } from '@playwright/test';

test.describe('Modo Restringido (Logo del Hospital)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@hospitalverapaz.gt');
    await page.fill('input[type="password"]', 'CambiarEsta123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\//);
  });

  test('Logo del hospital es un botón clicable', async ({ page }) => {
    const logo = page.locator('button:has(img[alt="Hospital Verapaz"])').first();
    await expect(logo).toBeVisible();
    await expect(logo).toBeEnabled();
  });

  test('Clic en logo alterna modo restringido', async ({ page }) => {
    const logo = page.locator('button:has(img[alt="Hospital Verapaz"])').first();
    
    // Estado inicial: modo normal
    await expect(page.locator('aside >> text=Tratamiento')).toBeVisible();
    
    // Clic en logo para activar modo restringido
    await page.click('button:has(img[alt="Hospital Verapaz"]) >> nth=0');
    
    // Verificar indicador visual
    await expect(page.locator('text=Modo restringido')).toBeVisible();
    
    // Verificar que se ocultan módulos
    await expect(page.locator('aside >> text=Tratamiento')).not.toBeVisible();
    await expect(page.locator('aside >> text=Farmacia')).not.toBeVisible();
    
    // Verificar que módulos permitidos siguen visibles
    await expect(page.locator('aside >> text=Registro y Admisión')).toBeVisible();
    await expect(page.locator('aside >> text=Expediente Clínico')).toBeVisible();
    await expect(page.locator('aside >> text=Bitácora de Visitas')).toBeVisible();
    
    // Verificar rotación del logo
    const logoImg = page.locator('img[alt="Hospital Verapaz"]').first();
    await expect(logoImg).toHaveAttribute('style', /rotate\(180deg\)/);
  });

  test('Segundo clic restaura modo normal', async ({ page }) => {
    await page.click('button:has(img[alt="Hospital Verapaz"]) >> nth=0');
    await expect(page.locator('text=Modo restringido')).toBeVisible();
    
    await page.click('button:has(img[alt="Hospital Verapaz"]) >> nth=0');
    await expect(page.locator('text=Modo restringido')).not.toBeVisible();
    await expect(page.locator('aside >> text=Tratamiento')).toBeVisible();
    await expect(page.locator('aside >> text=Farmacia')).toBeVisible();
  });
});