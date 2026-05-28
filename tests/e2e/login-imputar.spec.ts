import { test, expect } from '@playwright/test'

// Flujo 1: Login → imputar horas → verificar en Mi semana
// Requiere: seed DB + fixtures (contributor con proyectos asignados)

const CONTRIBUTOR = {
  email: 'contributor@gut.com',
  password: 'Contrib1234!',
}

test.describe('Login → imputar horas', () => {
  test('el contributor puede iniciar sesión', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /inicia sesión|bienvenido/i })).toBeVisible()

    await page.getByLabel(/email/i).fill(CONTRIBUTOR.email)
    await page.getByLabel(/contraseña|password/i).fill(CONTRIBUTOR.password)
    await page.getByRole('button', { name: /iniciar sesión|entrar/i }).click()

    await expect(page).toHaveURL(/\/(today|dashboard)/)
  })

  test('puede añadir una entrada de tiempo en Mi día', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(CONTRIBUTOR.email)
    await page.getByLabel(/contraseña|password/i).fill(CONTRIBUTOR.password)
    await page.getByRole('button', { name: /iniciar sesión|entrar/i }).click()
    await page.waitForURL(/\/(today|dashboard)/)

    // Navegar a hoy
    await page.goto('/today')
    await expect(page.getByText(/mi día|hoy/i).first()).toBeVisible()

    // Abrir drawer de entrada
    await page.getByRole('button', { name: /añadir entrada/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Rellenar form — proyecto es un select, cogemos el primero disponible
    const projectSelect = page.getByLabel(/proyecto/i)
    await projectSelect.click()
    const firstOption = page.getByRole('option').first()
    await firstOption.click()

    // Área
    const areaSelect = page.getByLabel(/área/i)
    if (await areaSelect.isVisible()) {
      await areaSelect.click()
      await page.getByRole('option').first().click()
    }

    // Horas
    const hoursInput = page.getByLabel(/horas/i)
    await hoursInput.fill('4')

    // Guardar
    await page.getByRole('button', { name: /guardar/i }).click()

    // El drawer debe cerrarse y aparecer la entrada
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText('4,0h').or(page.getByText('4.0h'))).toBeVisible()
  })

  test('la entrada aparece en la vista Semana', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(CONTRIBUTOR.email)
    await page.getByLabel(/contraseña|password/i).fill(CONTRIBUTOR.password)
    await page.getByRole('button', { name: /iniciar sesión|entrar/i }).click()
    await page.waitForURL(/\/(today|dashboard)/)

    await page.goto('/week')
    await expect(page.getByText(/esta semana/i)).toBeVisible()
    // La semana muestra el total — si hay alguna entrada, el total es > 0
    const kpiText = page.locator('text=/^\\d+[,.]\\d+h$/')
    await expect(kpiText.first()).toBeVisible()
  })
})
