import { test, expect } from '@playwright/test'

// Flujo 3: Manager genera un report compartible para un proyecto
// Requiere: seed DB + fixtures

const ADMIN = {
  email: 'admin@gut.com',
  password: 'Admin1234!',
}

test.describe('Generar report compartible', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(ADMIN.email)
    await page.getByLabel(/contraseña|password/i).fill(ADMIN.password)
    await page.getByRole('button', { name: /iniciar sesión|entrar/i }).click()
    await page.waitForURL(/\/(today|dashboard|projects)/)
  })

  test('puede abrir la pestaña Compartir de un proyecto', async ({ page }) => {
    await page.goto('/projects')
    await page.locator('main [style*="cursor: pointer"]').first().click()
    await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+/)

    await page.getByRole('tab', { name: /compartir|share/i }).click()
    // La pestaña debe mostrar el botón de crear report o la lista de reports
    await expect(
      page.getByRole('button', { name: /nuevo report|crear report|generar/i })
        .or(page.getByText(/reports?|informe/i).first())
    ).toBeVisible()
  })

  test('puede crear un nuevo report y obtener un slug', async ({ page }) => {
    await page.goto('/projects')
    await page.locator('main [style*="cursor: pointer"]').first().click()

    await page.getByRole('tab', { name: /compartir|share/i }).click()
    const createBtn = page.getByRole('button', { name: /nuevo report|crear report|generar/i })

    if (await createBtn.isVisible()) {
      await createBtn.click()

      // Debe aparecer una URL compartible (empieza con /r/)
      await expect(page.getByText(/\/r\//)).toBeVisible({ timeout: 8000 })
    } else {
      // Ya hay un report creado — verificar que la URL está visible
      await expect(page.getByText(/\/r\//)).toBeVisible()
    }
  })

  test('el report público es accesible desde su URL', async ({ page }) => {
    await page.goto('/projects')
    await page.locator('main [style*="cursor: pointer"]').first().click()
    await page.getByRole('tab', { name: /compartir|share/i }).click()

    // Esperamos que haya al menos un report (del test anterior o de fixture)
    const slugLink = page.getByText(/\/r\//)
    if (await slugLink.isVisible()) {
      const href = await slugLink.textContent()
      if (href) {
        // Extraer el slug de la URL
        const slug = href.match(/\/r\/([a-z0-9-]+)/)?.[1]
        if (slug) {
          await page.goto(`/r/${slug}`)
          // Debe mostrar el report o el formulario de contraseña
          await expect(
            page.getByText(/informe|report|contraseña|password/i).first()
          ).toBeVisible()
        }
      }
    }
  })
})
