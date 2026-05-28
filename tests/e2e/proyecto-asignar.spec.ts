import { test, expect } from '@playwright/test'

// Flujo 2: Manager navega a un proyecto y puede acceder a la pestaña Equipo
// Requiere: seed DB + fixtures (proyecto Gut Rebrand activo)

const MANAGER = {
  email: 'manager@gut.com',
  password: 'Manager1234!',
}

test.describe('Proyectos → equipo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(MANAGER.email)
    await page.getByLabel(/contraseña|password/i).fill(MANAGER.password)
    await page.getByRole('button', { name: /iniciar sesión|entrar/i }).click()
    await page.waitForURL(/\/(today|dashboard|projects)/)
  })

  test('el manager puede ver la lista de proyectos', async ({ page }) => {
    await page.goto('/projects')
    await expect(page.getByText(/proyectos/i).first()).toBeVisible()
    // Debe haber al menos un proyecto (del fixture)
    await expect(page.getByRole('link').or(page.locator('[data-role-card]')).first()).toBeVisible()
  })

  test('puede abrir un proyecto y ver las pestañas', async ({ page }) => {
    await page.goto('/projects')
    // Clicar en la primera card de proyecto
    await page.locator('main [style*="cursor: pointer"]').first().click()
    await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+/)

    // Deben ser visibles las pestañas principales
    await expect(page.getByRole('tab', { name: /resumen|overview/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /equipo|team/i })).toBeVisible()
  })

  test('puede navegar a la pestaña Equipo', async ({ page }) => {
    await page.goto('/projects')
    await page.locator('main [style*="cursor: pointer"]').first().click()

    await page.getByRole('tab', { name: /equipo|team/i }).click()
    // La pestaña debe mostrar contenido (personas asignadas o empty state)
    await expect(
      page.getByText(/asignaciones|sin personas/i).or(page.getByRole('button', { name: /añadir/i }))
    ).toBeVisible()
  })
})
