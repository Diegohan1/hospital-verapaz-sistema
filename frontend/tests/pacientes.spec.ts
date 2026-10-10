import { test, expect } from '@playwright/test';

test.describe('Registro y Admisión - Navegación y UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@hospitalverapaz.gt');
    await page.fill('input[type="password"]', process.env.SEED_ADMIN_PASSWORD || 'CambiarEsta123');
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

  test('Acciones de escaneo visibles en paciente nuevo', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Escanear en esta computadora/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Escanear con el teléfono/ })).toBeVisible();
  });

  test('Formulario de nuevo paciente tiene campos requeridos', async ({ page }) => {
    const camposNumericosFechaYTexto = [
      'fechaIngreso', 'horaIngreso', 'historiaClinica', 'nombreCompleto', 'direccion', 'telefono',
      'lugarNacimiento', 'fechaNacimiento', 'edad', 'sexo', 'ocupacion', 'religion', 'nacionalidad', 'dpi',
    ];
    for (const nombre of camposNumericosFechaYTexto) {
      const input = page.locator(`[name="${nombre}"]`);
      await expect(input).toBeVisible();
      await expect(input).toHaveAttribute('required', '');
    }
    const estadoCivil = page.locator('input[type="radio"][name="estadoCivil"]');
    await expect(estadoCivil).toHaveCount(5);
    await expect(estadoCivil.first()).toHaveAttribute('required', '');
    await expect(page.locator('input[name="telefono"]')).toHaveAttribute('inputmode', 'numeric');
    await expect(page.locator('input[name="dpi"]')).toHaveAttribute('pattern', '[0-9]{13}');
  });

  test('Datos opcionales permanecen colapsados y se pueden desplegar', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Mostrar datos opcionales' })).toBeVisible();
    await expect(page.locator('[name="nombreConyuge"]')).toBeHidden();
    await page.getByRole('button', { name: 'Mostrar datos opcionales' }).click();
    await expect(page.locator('[name="nombreConyuge"]')).toBeVisible();
    await expect(page.locator('[name="fechaEgreso"]')).toBeVisible();
    await expect(page.getByText('Maternidad', { exact: true })).toBeVisible();
  });

  test('Envía el orden correcto y normaliza los campos numéricos', async ({ page }) => {
    let pacienteEnviado;
    await page.route('**/api/pacientes', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      pacienteEnviado = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 9001, historiaClinica: pacienteEnviado.historiaClinica, nombreCompleto: pacienteEnviado.nombreCompleto }),
      });
    });

    await page.fill('[name="fechaIngreso"]', '2026-10-09');
    await page.fill('[name="horaIngreso"]', '14ab30');
    await expect(page.locator('[name="horaIngreso"]')).toHaveValue('1430');
    await page.fill('[name="historiaClinica"]', 'HC-00123');
    await expect(page.locator('[name="historiaClinica"]')).toHaveValue('00123');
    await page.fill('[name="nombreCompleto"]', 'Paciente Prueba');
    await page.fill('[name="direccion"]', 'Cobán');
    await page.fill('[name="telefono"]', '555-12345');
    await expect(page.locator('[name="telefono"]')).toHaveValue('55512345');
    await page.fill('[name="lugarNacimiento"]', 'Cobán');
    await page.fill('[name="fechaNacimiento"]', '1990-03-10');
    await page.fill('[name="edad"]', '3a5');
    await expect(page.locator('[name="edad"]')).toHaveValue('35');
    await page.fill('[name="sexo"]', 'Femenino');
    await page.locator('input[name="estadoCivil"][value="S"]').check();
    await page.fill('[name="ocupacion"]', 'Comerciante');
    await page.fill('[name="religion"]', 'Ninguna');
    await page.fill('[name="nacionalidad"]', 'Guatemalteca');
    await page.fill('[name="dpi"]', '1234567890101');
    await page.getByRole('button', { name: 'Mostrar datos opcionales' }).click();
    await page.fill('[name="nombreConyuge"]', 'Cónyuge Prueba');
    await page.getByRole('button', { name: 'Guardar paciente' }).click();

    await expect(page.getByText(/Paciente registrado con historia clínica 00123/)).toBeVisible();
    expect(pacienteEnviado).toMatchObject({
      historiaClinica: '00123',
      telefono: '55512345',
      edad: 35,
      estadoCivil: 'S',
      nombreConyuge: 'Cónyuge Prueba',
    });
    expect(Number.isNaN(Date.parse(pacienteEnviado.fechaIngreso))).toBe(false);
  });
});
